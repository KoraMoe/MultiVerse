import { ethers } from 'ethers';
import type { Ethereum } from './types';

/**
 * Verifier implementation for Ethereum signatures
 */
export class EthereumVerifier {
  /**
   * Verify an Ethereum signature against data and an address
   * @param data Data that was signed (will be hashed using keccak256)
   * @param signature Ethereum signature (65 bytes hex string with 0x prefix)
   * @param address Ethereum address that supposedly signed the data
   * @returns Promise resolving to boolean indicating if signature is valid
   */
  async verify(data: any, signature: Ethereum.Signature, address: Ethereum.Address): Promise<boolean> {
    try {
      // Convert data to string if it's an object
      const messageString = typeof data === 'object' ? JSON.stringify(data) : String(data);
      
      // Ethereum signed messages are prefixed with "\x19Ethereum Signed Message:\n" + length of message
      // We need to use the same method to verify as was used to sign
      const recoveredAddress = ethers.verifyMessage(messageString, signature);
      
      // Check if recovered address matches the expected address (case-insensitive)
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }
}

/**
 * Creates an Ethereum signature for testing purposes
 * @param privateKey Ethereum private key (32 bytes hex string with 0x prefix)
 * @param data Data to sign
 * @returns Promise resolving to signature
 */
export async function signData(privateKey: string, data: any): Promise<Ethereum.Signature> {
  // Convert data to string
  const messageString = typeof data === 'object' ? JSON.stringify(data) : String(data);
  
  // Create wallet from private key
  const wallet = new ethers.Wallet(privateKey);
  
  // Sign the message (this applies the Ethereum message prefix)
  const signature = await wallet.signMessage(messageString);
  
  return signature;
} 