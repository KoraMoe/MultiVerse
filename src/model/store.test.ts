import { describe, test, expect, beforeEach } from "bun:test";
import { Store } from './store';
import { Core, Profile, Timeline } from './types';
import type { Ethereum } from './types';
import { EthereumVerifier, signData } from './verifier';
import { ethers } from 'ethers';

// Array of valid CIDs for testing
// These are real CIDs that have the correct format
const TEST_CIDS: string[] = [
  "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", // Root/profile1
  "bafybeid46f7zggioxjm5p2ze2l6s6wbqvoo4gzbz3kpdncbmxbgfvtj5oe", // Profile2
  "bafybeifzunqkbi5z32jz2kriorxlcgv6oiop27s5izkk7d5nflhgz6eyiq", // Profile3
  "bafybeihprzyvilohk32kqmtlgg5zxbihdc4yxrqafik2nqzxh4ob2rlpgu", // Timeline1
  "bafybeiejwxdtue55wpvyhfkehygkwiihwp3wprmvzbyxiuhb3d5gfuentm", // Timeline2
  "bafybeigvftsl3b7o6nxzhu7sgo5q247inpietldbtuwvfnc7gbfjoq7m54", // Timeline3
  "bafybeialpe34gbcvfybfjlfx6ys45hpw5rebsqa2avzonaw7s34uqp7egu", // Mixed1
  "bafybeicjchlvee5xvschzosopoocdjrmhfcbvkfkthfinfnai5thdu7oza", // Mixed2
  "bafybeihj5nwudk7tqywj7gb6eerltl7oivfbwtivqrldg44piudgj3nbpi", // Note
  "bafybeifhvddvqbxnhn5qtqjjilbwvqdxbxq2sdem45yd5qynu7zbwlekku", // Invalid
  "bafybeidm4sgj43lm5yjwax3zzafygg3q3hwfcbqsxrfzopqkec4ihvwsty"  // NonExistent
];

describe('Store', () => {
  let store: Store;
  let verifier: EthereumVerifier;
  let wallet: ethers.HDNodeWallet;
  let operatorId: Ethereum.Address;

  beforeEach(async () => {
    // Create a real verifier
    verifier = new EthereumVerifier();
    
    // Create a wallet for testing
    wallet = ethers.Wallet.createRandom();
    operatorId = wallet.address;
    
    // Create the store with the verifier
    store = new Store(verifier, operatorId);
  });

  // Create helper function for creating blocks
  const createBlock = async <T>(previous: string | null, type: Core.BlockType, data: T): Promise<Core.Block<T>> => {
    // Create the block without signature
    const blockWithoutSignature = {
      previous: previous || undefined,
      timestamp: Date.now(),
      operator: operatorId,
      type,
      data
    };
    
    // Sign the block
    const signature = await signData(wallet.privateKey, blockWithoutSignature);
    
    // Return the complete block
    return {
      ...blockWithoutSignature,
      signature
    };
  };

  test('should create a store with the correct operator ID', () => {
    expect(store).toBeDefined();
  });

  test('should add a block with a valid signature', async () => {
    // Use undefined/null for the first block (root block)
    const block = await createBlock(
      null,
      Core.BlockType.PROFILE,
      { type: Profile.OperationType.SET_USERNAME, payload: { username: "testuser" } }
    );

    const result = await store.addBlock(block, TEST_CIDS[0]!);
    expect(result).toBe(true);
  });

  test('should reject a block with an invalid signature', async () => {
    // Create a valid block first as root block
    const block = await createBlock(
      null,
      Core.BlockType.PROFILE,
      { type: Profile.OperationType.SET_USERNAME, payload: { username: "testuser" } }
    );
    
    // Tamper with the signature
    const invalidBlock = {
      ...block,
      signature: "0x4355c47d63924e8a72e509b65029052eb6c299d53a04e167c5775fd466751c9d07299936d304c153f6443dfa05f40ff007d72911b6f72307f996231605b915621c"
    };

    await expect(store.addBlock(invalidBlock, TEST_CIDS[9]!)).rejects.toThrow("Invalid block signature");
  });

  test('should reject a block from incorrect operator', async () => {
    // Create a different wallet
    const differentWallet = ethers.Wallet.createRandom();
    const differentOperator = differentWallet.address;
    
    // Create a valid block as root block
    const block = await createBlock(
      null,
      Core.BlockType.PROFILE,
      { type: Profile.OperationType.SET_USERNAME, payload: { username: "testuser" } }
    );
    
    // Change the operator
    const invalidBlock = {
      ...block,
      operator: differentOperator
    };

    await expect(store.addBlock(invalidBlock, TEST_CIDS[10]!)).rejects.toThrow(/Block operator .* does not match expected operator/);
  });

  test('should reject a block with missing previous block', async () => {
    const block = await createBlock(
      TEST_CIDS[10]!,
      Core.BlockType.PROFILE,
      { type: Profile.OperationType.SET_USERNAME, payload: { username: "testuser" } }
    );

    await expect(store.addBlock(block, TEST_CIDS[1]!)).rejects.toThrow(/Previous block .* not found/);
  });

  test('should build profile state from operations', async () => {
    // First block is root block
    const block1 = await createBlock(
      null,
      Core.BlockType.PROFILE,
      { type: Profile.OperationType.SET_USERNAME, payload: { username: "testuser" } }
    );
    await store.addBlock(block1, TEST_CIDS[0]!);
    
    const block2 = await createBlock(
      TEST_CIDS[0]!,
      Core.BlockType.PROFILE,
      { type: Profile.OperationType.SET_BIO, payload: { bio: "test bio" } }
    );
    await store.addBlock(block2, TEST_CIDS[1]!);
    
    const block3 = await createBlock(
      TEST_CIDS[1]!,
      Core.BlockType.PROFILE,
      { type: Profile.OperationType.ADD_FOLLOWING, payload: { followingId: "user456" } }
    );
    await store.addBlock(block3, TEST_CIDS[2]!);

    const state = await store.getProfileState();
    
    expect(state.username).toBe("testuser");
    expect(state.bio).toBe("test bio");
    expect(state.following).toContain("user456");
  });

  test('should build timeline state from operations', async () => {
    // First block is root block
    const block1 = await createBlock(
      null,
      Core.BlockType.TIMELINE,
      { type: Timeline.OperationType.ADD_NOTE, payload: { noteCid: TEST_CIDS[8]! } }
    );
    await store.addBlock(block1, TEST_CIDS[3]!);
    
    const block2 = await createBlock(
      TEST_CIDS[3]!,
      Core.BlockType.TIMELINE,
      { type: Timeline.OperationType.ADD_NOTE, payload: { noteCid: TEST_CIDS[9]! } }
    );
    await store.addBlock(block2, TEST_CIDS[4]!);
    
    const block3 = await createBlock(
      TEST_CIDS[4]!,
      Core.BlockType.TIMELINE,
      { type: Timeline.OperationType.REMOVE_NOTE, payload: { noteCid: TEST_CIDS[8]! } }
    );
    await store.addBlock(block3, TEST_CIDS[5]!);

    const state = await store.getTimelineState();
    
    expect(state.notes.length).toBe(1);
    expect(state.notes[0]).toBe(TEST_CIDS[9]!);
  });

  test('should handle mixed block types', async () => {
    // First block is root block
    const block1 = await createBlock(
      null,
      Core.BlockType.PROFILE,
      { type: Profile.OperationType.SET_USERNAME, payload: { username: "testuser" } }
    );
    await store.addBlock(block1, TEST_CIDS[6]!);
    
    const block2 = await createBlock(
      TEST_CIDS[6]!,
      Core.BlockType.TIMELINE,
      { type: Timeline.OperationType.ADD_NOTE, payload: { noteCid: TEST_CIDS[8]! } }
    );
    await store.addBlock(block2, TEST_CIDS[7]!);

    const profileState = await store.getProfileState();
    const timelineState = await store.getTimelineState();
    
    expect(profileState.username).toBe("testuser");
    expect(timelineState.notes.length).toBe(1);
  });

  test('should throw when getting state with no blocks', async () => {
    await expect(store.getProfileState()).rejects.toThrow("No blocks found");
    await expect(store.getTimelineState()).rejects.toThrow("No blocks found");
  });
}); 