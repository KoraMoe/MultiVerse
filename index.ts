import { create } from 'kubo-rpc-client'
import { ethers } from 'ethers'
import { CID } from 'multiformats/cid'
import { Core, Profile, Timeline, Note } from './src/model/types'
import type { Ethereum } from './src/model/types'
import { EthereumVerifier, signData } from './src/model/verifier'
import { Store } from './src/model/store'

// IPFS Client setup
const client = create({
  url: process.env.IPFS_ENDPOINT || 'http://localhost:5001/api/v0',
})

// Initialize a wallet for our user
const createWallet = () => {
  // In production, you would use a secure method to manage private keys
  // For this experiment, we're generating a random wallet
  return ethers.Wallet.createRandom()
}

// Upload content to IPFS and return the CID
async function uploadToIPFS(content: any): Promise<string> {
  const contentStr = typeof content === 'object' ? JSON.stringify(content) : String(content)
  const contentBuffer = Buffer.from(contentStr)
  
  const added = await client.add({
    content: contentBuffer
  })
  
  return added.cid.toString()
}

// Create and sign a note
async function createNote(
  wallet: ethers.HDNodeWallet, 
  content: string, 
  type: Note.NoteType,
  replyTo?: string,
  originalNote?: string
): Promise<{ cid: string, note: Note.Content }> {
  // Create note content
  const noteContent: Note.Content = {
    content,
    createdAt: Date.now(),
    type,
    author: wallet.address,
    signature: '', // Will be added after signing
    attachments: [],
  }
  
  // Add optional fields if provided
  if (replyTo) {
    noteContent.replyTo = replyTo
  }
  
  if (originalNote) {
    noteContent.originalNote = originalNote
  }
  
  // Sign the note content (without the signature field)
  const { signature, ...contentToSign } = noteContent
  noteContent.signature = await signData(wallet.privateKey, contentToSign)
  
  // Upload to IPFS and get CID
  const cid = await uploadToIPFS(noteContent)
  
  return { cid, note: noteContent }
}

// Upload a block to IPFS and return the CID
async function uploadBlockToIPFS<T>(block: Core.Block<T>): Promise<string> {
  return await uploadToIPFS(block)
}

// Publish a message to a gossipsub topic
async function publish(topic: string, message: any, wallet?: ethers.HDNodeWallet): Promise<void> {
  let messageToPublish: any = message;
  
  // If wallet is provided, sign the message
  if (wallet) {
    const signature = await signData(wallet.privateKey, message);
    messageToPublish = {
      message,
      signature,
      publisher: wallet.address
    };
  }
  
  const messageStr = JSON.stringify(messageToPublish);
  const messageBuffer = Buffer.from(messageStr);
  
  try {    
    // Publish the message
    await client.pubsub.publish(topic, messageBuffer)
    console.log(`Published message to topic: ${topic}`)
  } catch (error) {
    console.error('Error publishing to gossipsub:', error)
    throw error
  }
}

// Subscribe to a user's outbox and reconstruct their state
async function followUser(userAddress: string, store: Store): Promise<void> {
  const outboxTopic = `outbox:${userAddress}`
  
  // Subscribe to user's outbox
  await client.pubsub.subscribe(outboxTopic, async (msg) => {
    try {
      // Parse the message
      const strData = Buffer.from(msg.data).toString()
      const data = JSON.parse(strData)
      
      // Verify signature if needed
      // Assuming message format: { message, signature, publisher }
      
      // Extract block CID from update message
      const blockCid = data.message.content.block
      console.log(`Received update from ${userAddress}, latest block: ${blockCid}`)
      
      // Recursively fetch and process the line
      await processUserline(blockCid, store)
      
      // Now we can get the updated state
      console.log(`Updated state for user ${userAddress}`)

      const reconstructedProfile = await store.getProfileState()
      const reconstructedTimeline = await store.getTimelineState()
      
      console.log('\nReconstructed Profile State:')
      console.log(JSON.stringify(reconstructedProfile, null, 2))
      
      console.log('\nReconstructed Timeline State:')
      console.log(JSON.stringify(reconstructedTimeline, null, 2))

      // Display note details
      await displayNotes(reconstructedTimeline)
      
    } catch (error) {
      console.error('Error processing message:', error)
    }
  }, { discover: true })
  
  console.log(`Following user ${userAddress}`)
}

// Recursively fetch and process blocks starting from the latest
async function processUserline(latestBlockCid: string, store: Store): Promise<void> {
  const visited = new Set<string>()
  
  async function processBlock(blockCid: string): Promise<void> {
    // Skip if already processed
    if (visited.has(blockCid)) return
    visited.add(blockCid)
    
    // Fetch the block from IPFS
    const blockData = await client.cat(blockCid)
    // Convert AsyncIterable to string
    let contentStr = ''
    for await (const chunk of blockData) {
      contentStr += Buffer.from(chunk).toString()
    }
    const block = JSON.parse(contentStr)
    
    // Add block to store
    await store.addBlock(block, blockCid)
    
    // Process previous block if exists
    if (block.previous) {
      await processBlock(block.previous)
    }
  }
  
  await processBlock(latestBlockCid)
  console.log(`Processed ${visited.size} blocks for user`)
}

// Fetch note details from IPFS by CID
async function getNoteDetails(noteCid: string): Promise<Note.Content> {
  const noteData = await client.cat(noteCid)
  let contentStr = ''
  for await (const chunk of noteData) {
    contentStr += Buffer.from(chunk).toString()
  }
  return JSON.parse(contentStr)
}

// Display notes from a timeline
async function displayNotes(timelineState: Timeline.State): Promise<void> {
  console.log('\nNote Details:')
  
  for (const noteCid of timelineState.notes) {
    try {
      const note = await getNoteDetails(noteCid)
      console.log(`\nNote CID: ${noteCid}`)
      console.log(`Author: ${note.author}`)
      console.log(`Content: ${note.content}`)
      console.log(`Type: ${Note.NoteType[note.type]}`)
      console.log(`Created: ${new Date(note.createdAt).toLocaleString()}`)
      
      if (note.replyTo) {
        console.log(`Reply to: ${note.replyTo}`)
      }
      
      if (note.originalNote) {
        console.log(`Original note: ${note.originalNote}`)
      }
      
      console.log('-'.repeat(40))
    } catch (error) {
      console.error(`Error fetching note ${noteCid}:`, error)
    }
  }
}

// Main function to run our experiment
async function main() {
  console.log('Starting Multiverse experiment...')
  
  // Step 1: Create a wallet for our user
  const wallet = createWallet()
  console.log(`Created wallet with address: ${wallet.address}`)
  
  // Step 2: Create a verifier and store
  const verifier = new EthereumVerifier()

  // Create a new store for the follower
  const followerStore = new Store(verifier, wallet.address)
  
  // Start following our original user
  await followUser(wallet.address, followerStore)
    
  const store = new Store(verifier, wallet.address)
  
  // Step 3: Create profile blocks to build the profile
  console.log('\nBuilding profile...')
  
  // Set username - Root Block (no previous)
  const setUsernameOp: Profile.Operation = {
    type: Profile.OperationType.SET_USERNAME,
    payload: { username: 'Rorical' }
  }
  
  // Create the root block (no previous)
  const usernameBlockData = {
    previous: undefined, // Root block has no previous
    timestamp: Date.now(),
    operator: wallet.address,
    type: Core.BlockType.PROFILE,
    data: setUsernameOp
  }
  
  // Sign the root block
  const usernameBlockSignature = await signData(wallet.privateKey, usernameBlockData)
  
  // Complete root block
  const usernameBlock = {
    ...usernameBlockData,
    signature: usernameBlockSignature
  }
  
  // Upload the block to IPFS and get its CID
  const usernameBlockCid = await uploadBlockToIPFS(usernameBlock)
  
  // Add root block to the store
  await store.addBlock(usernameBlock, usernameBlockCid)
  console.log(`Added Root Block (SET_USERNAME) with CID: ${usernameBlockCid}`)
  
  // Set bio - second block
  const setBioOp: Profile.Operation = {
    type: Profile.OperationType.SET_BIO,
    payload: { bio: 'Meow meow meow' }
  }
  
  // Create and sign the second block
  const bioBlockData = {
    previous: usernameBlockCid,
    timestamp: Date.now(),
    operator: wallet.address,
    type: Core.BlockType.PROFILE,
    data: setBioOp
  }
  
  const bioBlockSignature = await signData(wallet.privateKey, bioBlockData)
  
  // Complete block
  const bioBlock = {
    ...bioBlockData,
    signature: bioBlockSignature
  }
  
  // Upload the block to IPFS and get its CID
  const bioBlockCid = await uploadBlockToIPFS(bioBlock)
  
  // Add to the store
  await store.addBlock(bioBlock, bioBlockCid)
  console.log(`Added SET_BIO block with CID: ${bioBlockCid}`)
  
  // Step 4: Create some notes and add them to the timeline
  console.log('\nCreating notes...')
  
  // Create the first note
  const { cid: note1Cid } = await createNote(
    wallet,
    'Hello decentralized world! This is my first note.',
    Note.NoteType.ORIGINAL
  )
  console.log(`Created note with CID: ${note1Cid}`)
  
  // Add the note to the timeline
  const addNote1Op: Timeline.Operation = {
    type: Timeline.OperationType.ADD_NOTE,
    payload: { noteCid: note1Cid }
  }
  
  // Create and sign the block
  const note1BlockData = {
    previous: bioBlockCid, // Reference the previous block
    timestamp: Date.now(),
    operator: wallet.address,
    type: Core.BlockType.TIMELINE,
    data: addNote1Op
  }
  
  const note1BlockSignature = await signData(wallet.privateKey, note1BlockData)
  
  // Complete block
  const note1Block = {
    ...note1BlockData,
    signature: note1BlockSignature
  }
  
  // Upload the block to IPFS and get its CID
  const note1BlockCid = await uploadBlockToIPFS(note1Block)
  
  // Add to the store
  await store.addBlock(note1Block, note1BlockCid)
  console.log(`Added first note to timeline with block CID: ${note1BlockCid}`)
  
  // Create a second note (a reply to the first)
  const { cid: note2Cid } = await createNote(
    wallet,
    'This is a follow-up to my first note!',
    Note.NoteType.REPLY,
    note1Cid
  )
  console.log(`Created reply note with CID: ${note2Cid}`)
  
  // Add the second note to the timeline
  const addNote2Op: Timeline.Operation = {
    type: Timeline.OperationType.ADD_NOTE,
    payload: { noteCid: note2Cid }
  }
  
  // Create and sign the block
  const note2BlockData = {
    previous: note1BlockCid, // Reference the previous block
    timestamp: Date.now(),
    operator: wallet.address,
    type: Core.BlockType.TIMELINE,
    data: addNote2Op
  }
  
  const note2BlockSignature = await signData(wallet.privateKey, note2BlockData)
  
  // Complete block
  const note2Block = {
    ...note2BlockData,
    signature: note2BlockSignature
  }
  
  // Upload the block to IPFS and get its CID
  const note2BlockCid = await uploadBlockToIPFS(note2Block)
  
  // Add to the store
  await store.addBlock(note2Block, note2BlockCid)
  console.log(`Added second note to timeline with block CID: ${note2BlockCid}`)
  
  // Step 5: Get the final state
  const profileState = await store.getProfileState()
  const timelineState = await store.getTimelineState()
  
  console.log('\nFinal Profile State:')
  console.log(JSON.stringify(profileState, null, 2))
  
  console.log('\nFinal Timeline State:')
  console.log(JSON.stringify(timelineState, null, 2))
  
  // Step 6: Publish the latest note to the outbox gossipsub channel
  const outboxTopic = `outbox:${wallet.address}`
  const updateMessage = {
    type: 'update',
    content: {
      block: note2BlockCid,
      timestamp: Date.now()
    }
  }
  
  // Publish with signature
  await publish(outboxTopic, updateMessage, wallet)

  console.log(`\nPublished signed update to ${outboxTopic}`)
}

// Run the experiment
main().catch(console.error)
