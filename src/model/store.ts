import { Core, Profile, Timeline } from './types'
import type { Note, File, Ethereum } from './types'

/**
 * Verification interface for Ethereum signature validation
 */
export interface Verifier {
  verify(data: any, signature: Ethereum.Signature, address: Ethereum.Address): Promise<boolean>;
}

/**
 * Store implementation to parse blocks into states for a single user
 */
export class Store {
  private verifier: Verifier;
  private blocks: Map<string, Core.Block<any>> = new Map();
  private operatorId: string;
  
  constructor(verifier: Verifier, operatorId: string) {
    this.verifier = verifier;
    this.operatorId = operatorId;
  }

  /**
   * Add a new block to the store
   * @param block Block to add
   * @param blockCid Optional CID to use for this block (for testing)
   * @returns Promise resolving to true if block was added successfully
   */
  async addBlock<T>(block: Core.Block<T>, blockCid: string): Promise<boolean> {
    // Ensure block is from the expected operator
    if (block.operator !== this.operatorId) {
      throw new Error(`Block operator ${block.operator} does not match expected operator ${this.operatorId}`);
    }
    
    // Verify signature
    const isValid = await this.verifyBlockSignature(block);
    if (!isValid) {
      throw new Error("Invalid block signature");
    }
    
    
    // Store block with its CID
    this.blocks.set(blockCid, {...block});
    
    return true;
  }
  
  /**
   * Get the CID of a block that has been added to the store
   * @param block Block to find the CID for
   * @returns Promise resolving to the CID of the block, or null if not found
   */
  async getBlockCid<T>(block: Core.Block<T>): Promise<string> {
    // Find the block in the store by comparing relevant properties
    for (const [cid, storedBlock] of this.blocks.entries()) {
      // Compare timestamp and signature which should be unique for each block
      if (storedBlock.timestamp === block.timestamp && 
          storedBlock.signature === block.signature) {
        return cid;
      }
    }
    
    throw new Error("Block not found in store");
  }
  
  /**
   * Verify block signature
   * @param block Block to verify
   * @returns Promise resolving to true if signature is valid
   */
  private async verifyBlockSignature<T>(block: Core.Block<T>): Promise<boolean> {
    // Create a copy of the block without the signature for verification
    const blockWithoutSignature = {
      previous: block.previous,
      timestamp: block.timestamp,
      operator: block.operator,
      type: block.type,
      data: block.data
    };
    
    // Verify signature using the verifier
    return this.verifier.verify(
      blockWithoutSignature,
      block.signature,
      block.operator
    );
  }
  
  /**
   * Get profile state
   * @returns Promise resolving to profile state
   */
  async getProfileState(): Promise<Profile.State> {
    // Initialize default state
    let state: Profile.State = {
      username: "",
      bio: "",
      following: []
    };
    
    // Build chain of blocks
    const chain = this.getline();
    
    // Apply operations in chronological order
    for (const block of chain) {
      if (block.type === Core.BlockType.PROFILE) {
        const operation = block.data as Profile.Operation;
        state = this.applyProfileOperation(state, operation);
      }
    }
    
    return state;
  }
  
  /**
   * Apply a profile operation to a state
   * @param state Current state
   * @param operation Operation to apply
   * @returns Updated state
   */
  private applyProfileOperation(state: Profile.State, operation: Profile.Operation): Profile.State {
    // Clone the state to avoid mutations
    const newState = { ...state };
    
    switch (operation.type) {
      case Profile.OperationType.SET_USERNAME:
        newState.username = operation.payload.username;
        break;
        
      case Profile.OperationType.SET_BIO:
        newState.bio = operation.payload.bio;
        break;
        
      case Profile.OperationType.SET_AVATAR:
        newState.avatar = operation.payload.avatar;
        break;
        
      case Profile.OperationType.ADD_FOLLOWING:
        if (!newState.following.includes(operation.payload.followingId)) {
          newState.following = [...newState.following, operation.payload.followingId];
        }
        break;
        
      case Profile.OperationType.REMOVE_FOLLOWING:
        newState.following = newState.following.filter(
          id => id !== operation.payload.followingId
        );
        break;
    }
    
    return newState;
  }
  
  /**
   * Get timeline state
   * @returns Promise resolving to timeline state
   */
  async getTimelineState(): Promise<Timeline.State> {
    // Initialize default state
    let state: Timeline.State = {
      notes: []
    };
    
    // Build chain of blocks
    const chain = this.getline();
    
    // Apply operations in chronological order
    for (const block of chain) {
      if (block.type === Core.BlockType.TIMELINE) {
        const operation = block.data as Timeline.Operation;
        state = this.applyTimelineOperation(state, operation);
      }
    }
    
    return state;
  }
  
  /**
   * Apply a timeline operation to a state
   * @param state Current state
   * @param operation Operation to apply
   * @returns Updated state
   */
  private applyTimelineOperation(state: Timeline.State, operation: Timeline.Operation): Timeline.State {
    // Clone the state to avoid mutations
    const newState = { 
      notes: [...state.notes]
    };
    
    switch (operation.type) {
      case Timeline.OperationType.ADD_NOTE:
        if (!newState.notes.includes(operation.payload.noteCid)) {
          newState.notes.push(operation.payload.noteCid);
        }
        break;
        
      case Timeline.OperationType.REMOVE_NOTE:
        newState.notes = newState.notes.filter(cid => cid !== operation.payload.noteCid);
        break;
    }
    
    return newState;
  }
  
  /**
   * Get a chain of blocks in chronological order
   * @returns Array of blocks in chronological order (oldest first)
   */
  private getline(): Core.Block<any>[] {
    // Create a map of blocks by their CID for easy lookup
    const blockMap = new Map<string, {
      block: Core.Block<any>,
      cid: string
    }>();
    
    // Create a map of children for each block
    const childrenMap = new Map<string, string[]>();
    
    // Initialize childrenMap with empty arrays for all blocks including root and genesis
    childrenMap.set("", []);
    
    // Process all blocks to build the parent-child relationships
    for (const [blockCid, block] of this.blocks.entries()) {
      // Store the block with its CID
      blockMap.set(blockCid, { block, cid: blockCid });
      
      // Initialize an empty children array for this block
      if (!childrenMap.has(blockCid)) {
        childrenMap.set(blockCid, []);
      }
      
      // Get the previous block's CID
      const prevCid = block.previous || '';
      
      // Add this block as a child of its parent
      if (!childrenMap.has(prevCid)) {
        childrenMap.set(prevCid, []);
      }
      
      childrenMap.get(prevCid)?.push(blockCid);
    }
    
    // Find all blocks with root or genesis as parent
    const rootChildren = [...(childrenMap.get("") || [])];
    
    // Start building the chain from the root/genesis
    const orderedBlocks: Core.Block<any>[] = [];
    this.buildOrderedChain(rootChildren, blockMap, childrenMap, orderedBlocks);
    
    return orderedBlocks;
  }
  
  /**
   * Recursively build an ordered chain of blocks
   */
  private buildOrderedChain(
    blockCids: string[],
    blockMap: Map<string, { block: Core.Block<any>, cid: string }>,
    childrenMap: Map<string, string[]>,
    result: Core.Block<any>[]
  ): void {
    // Sort blocks by timestamp to ensure chronological order
    const sortedCids = [...blockCids].sort((a, b) => {
      const blockA = blockMap.get(a)?.block;
      const blockB = blockMap.get(b)?.block;
      
      if (!blockA || !blockB) return 0;
      
      return blockA.timestamp - blockB.timestamp;
    });
    
    // Process blocks in order
    for (const cid of sortedCids) {
      const blockInfo = blockMap.get(cid);
      if (!blockInfo) continue;
      
      // Add block to result
      result.push(blockInfo.block);
      
      // Process children
      const children = childrenMap.get(cid) || [];
      this.buildOrderedChain(children, blockMap, childrenMap, result);
    }
  }
} 