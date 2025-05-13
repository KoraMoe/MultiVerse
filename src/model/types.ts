/**
 * Ethereum related types
 */
export namespace Ethereum {
  /**
   * Ethereum address (20 bytes, hex string with 0x prefix)
   * Example: 0x71C7656EC7ab88b098defB751B7401B5f6d8976F
   */
  export type Address = string;

  /**
   * Ethereum signature (65 bytes, hex string with 0x prefix)
   * r, s, v components concatenated
   * Example: 0x4355c47d63924e8a72e509b65029052eb6c299d53a04e167c5775fd466751c9d07299936d304c153f6443dfa05f40ff007d72911b6f72307f996231605b915621c
   */
  export type Signature = string;
}

/**
 * Core blockchain structures
 */
export namespace Core {
  /**
   * Block types supported in the system
   */
  export enum BlockType {
    PROFILE = 'PROFILE',
    TIMELINE = 'TIMELINE',
    // Can extend with other types later
  }

  export interface Block<T> {
    previous?: string
    timestamp: number
    operator: Ethereum.Address
    signature: Ethereum.Signature
    type: BlockType
    data: T
  }
}

/**
 * File related types
 */
export namespace File {
  /**
   * File metadata structure stored in IPFS
   */
  export interface Metadata {
    mimetype: string
    user: Ethereum.Address
    signature: Ethereum.Signature
    timestamp: number
    size?: number
    name?: string
  }

  export interface File {
    metadata: Metadata
    content: string
  }
}

/**
 * Note related types
 */
export namespace Note {
  /**
   * Note content structure stored in IPFS
   */

  export enum NoteType {
    ORIGINAL = 'ORIGINAL',
    FORWARD = 'FORWARD',
    REPLY = 'REPLY',
    QUOTE = 'QUOTE'
  }

  export interface Content {
    content?: string
    createdAt: number
    attachments?: string[]
    replyTo?: string  // CID of note this is replying to
    originalNote?: string  // CID of original note for forward/quotes
    author: Ethereum.Address  // Ethereum address of the author
    signature: Ethereum.Signature
    type: NoteType
  }
}

/**
 * User profile related types
 */
export namespace Profile {
  /**
   * User profile state representation
   */
  export interface State {
    username: string
    bio: string
    avatar?: string  // Optional CID to avatar image stored in IPFS
    following: string[]  // Array of user IDs the user follows
  }

  /**
   * Available profile operation types
   */
  export enum OperationType {
    SET_USERNAME = 'SET_USERNAME',
    SET_BIO = 'SET_BIO',
    SET_AVATAR = 'SET_AVATAR',
    ADD_FOLLOWING = 'ADD_FOLLOWING',
    REMOVE_FOLLOWING = 'REMOVE_FOLLOWING'
  }

  /**
   * Operation payload definitions
   */
  export namespace Payload {
    export interface SetUsername {
      username: string;
    }

    export interface SetBio {
      bio: string;
    }

    export interface SetAvatar {
      avatar: string;
    }

    export interface AddFollowing {
      followingId: string;
    }

    export interface RemoveFollowing {
      followingId: string;
    }
  }

  /**
   * Union type of all possible profile operations
   */
  export type Operation =
    | { type: OperationType.SET_USERNAME; payload: Payload.SetUsername }
    | { type: OperationType.SET_BIO; payload: Payload.SetBio }
    | { type: OperationType.SET_AVATAR; payload: Payload.SetAvatar }
    | { type: OperationType.ADD_FOLLOWING; payload: Payload.AddFollowing }
    | { type: OperationType.REMOVE_FOLLOWING; payload: Payload.RemoveFollowing };
}

/**
 * Timeline related types
 */
export namespace Timeline {
  /**
   * Timeline state representation
   */
  export interface State {
    notes: string[]  // Array of string CIDs referencing notes in IPFS
  }

  /**
   * Available timeline operation types
   */
  export enum OperationType {
    ADD_NOTE = 'ADD_NOTE',
    REMOVE_NOTE = 'REMOVE_NOTE'
  }

  /**
   * Operation payload definitions
   */
  export namespace Payload {
    export interface AddNote {
      noteCid: string;
    }

    export interface RemoveNote {
      noteCid: string;
    }
  }

  /**
   * Union type of all possible timeline operations
   */
  export type Operation =
    | { type: OperationType.ADD_NOTE; payload: Payload.AddNote }
    | { type: OperationType.REMOVE_NOTE; payload: Payload.RemoveNote };
}

