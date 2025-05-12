import { CID } from 'multiformats/cid'

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
    previous: CID
    timestamp: number
    operator: string
    signature: string
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
    user: string
    signature: string
    timestamp: number
    size?: number
    name?: string
  }

  export interface File {
    metadata: Metadata
    content: CID
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
    attachments?: CID[]
    replyTo?: CID  // CID of note this is replying to
    originalNote?: CID  // CID of original note for forward/quotes
    author: string  // User ID of the author
    signature: string
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
    avatar?: CID  // Optional CID to avatar image stored in IPFS
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
      avatar: CID;
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
    notes: CID[]  // Array of CIDs referencing notes in IPFS
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
      noteCid: CID;
    }

    export interface RemoveNote {
      noteCid: CID;
    }
  }

  /**
   * Union type of all possible timeline operations
   */
  export type Operation =
    | { type: OperationType.ADD_NOTE; payload: Payload.AddNote }
    | { type: OperationType.REMOVE_NOTE; payload: Payload.RemoveNote };
}

