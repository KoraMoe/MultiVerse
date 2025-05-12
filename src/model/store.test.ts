import { describe, test, expect, beforeEach, mock } from "bun:test";
import { CID } from 'multiformats/cid';
import { Store } from './store';
import { Core, Profile, Timeline } from './types';

// Mock the CID class
const mockCidCreate = (str: string): CID => {
  return {
    toString: () => str,
  } as unknown as CID;
};

// Create a mock verifier
class MockVerifier {
  shouldVerify: boolean = true;

  verify(data: any, signature: string, publicKey: string): Promise<boolean> {
    return Promise.resolve(this.shouldVerify);
  }
}

describe('Store', () => {
  let store: Store;
  let verifier: MockVerifier;
  const operatorId = "user123";
  const ROOT_CID = "";

  // Create helper function for creating blocks
  const createBlock = <T>(previous: string, type: Core.BlockType, data: T): Core.Block<T> => {
    return {
      previous: mockCidCreate(previous),
      timestamp: Date.now(),
      operator: operatorId,
      signature: "validSignature",
      type,
      data
    };
  };

  beforeEach(() => {
    verifier = new MockVerifier();
    store = new Store(verifier, operatorId);
  });

  test('should create a store with the correct operator ID', () => {
    expect(store).toBeDefined();
  });

  test('should add a block with a valid signature', async () => {
    const block = createBlock(
      ROOT_CID,
      Core.BlockType.PROFILE,
      { type: Profile.OperationType.SET_USERNAME, payload: { username: "testuser" } }
    );

    const result = await store.addBlock(block);
    expect(result).toBe(true);
  });

  test('should reject a block with an invalid signature', async () => {
    verifier.shouldVerify = false;
    
    const block = createBlock(
      ROOT_CID,
      Core.BlockType.PROFILE,
      { type: Profile.OperationType.SET_USERNAME, payload: { username: "testuser" } }
    );

    await expect(store.addBlock(block)).rejects.toThrow("Invalid block signature");
  });

  test('should reject a block from incorrect operator', async () => {
    const block = {
      ...createBlock(
        ROOT_CID,
        Core.BlockType.PROFILE,
        { type: Profile.OperationType.SET_USERNAME, payload: { username: "testuser" } }
      ),
      operator: "wrong-operator"
    };

    await expect(store.addBlock(block)).rejects.toThrow(/Block operator .* does not match expected operator/);
  });

  test('should reject a block with missing previous block', async () => {
    const block = createBlock(
      "non-existent-cid",
      Core.BlockType.PROFILE,
      { type: Profile.OperationType.SET_USERNAME, payload: { username: "testuser" } }
    );

    await expect(store.addBlock(block)).rejects.toThrow(/Previous block .* not found/);
  });

  test('should build profile state from operations', async () => {
    const block1 = createBlock(
      ROOT_CID,
      Core.BlockType.PROFILE,
      { type: Profile.OperationType.SET_USERNAME, payload: { username: "testuser" } }
    );
    await store.addBlock(block1);

    const cid1 = block1.previous.toString();
    
    const block2 = createBlock(
      cid1,
      Core.BlockType.PROFILE,
      { type: Profile.OperationType.SET_BIO, payload: { bio: "test bio" } }
    );
    await store.addBlock(block2);

    const cid2 = block2.previous.toString();
    
    const block3 = createBlock(
      cid2,
      Core.BlockType.PROFILE,
      { type: Profile.OperationType.ADD_FOLLOWING, payload: { followingId: "user456" } }
    );
    await store.addBlock(block3);

    const state = await store.getProfileState();
    
    expect(state.username).toBe("testuser");
    expect(state.bio).toBe("test bio");
    expect(state.following).toContain("user456");
  });

  test('should build timeline state from operations', async () => {
    const noteCid1 = mockCidCreate("note1");
    const noteCid2 = mockCidCreate("note2");
    
    const block1 = createBlock(
      ROOT_CID,
      Core.BlockType.TIMELINE,
      { type: Timeline.OperationType.ADD_NOTE, payload: { noteCid: noteCid1 } }
    );
    await store.addBlock(block1);

    const cid1 = block1.previous.toString();
    
    const block2 = createBlock(
      cid1,
      Core.BlockType.TIMELINE,
      { type: Timeline.OperationType.ADD_NOTE, payload: { noteCid: noteCid2 } }
    );
    await store.addBlock(block2);

    const cid2 = block2.previous.toString();
    
    const block3 = createBlock(
      cid2,
      Core.BlockType.TIMELINE,
      { type: Timeline.OperationType.REMOVE_NOTE, payload: { noteCid: noteCid1 } }
    );
    await store.addBlock(block3);

    const state = await store.getTimelineState();
    
    expect(state.notes.length).toBe(1);
    expect(state.notes[0]?.toString()).toBe("note2");
  });

  test('should handle mixed block types', async () => {
    const block1 = createBlock(
      ROOT_CID,
      Core.BlockType.PROFILE,
      { type: Profile.OperationType.SET_USERNAME, payload: { username: "testuser" } }
    );
    await store.addBlock(block1);

    const cid1 = block1.previous.toString();
    
    const noteCid = mockCidCreate("note1");
    const block2 = createBlock(
      cid1,
      Core.BlockType.TIMELINE,
      { type: Timeline.OperationType.ADD_NOTE, payload: { noteCid } }
    );
    await store.addBlock(block2);

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