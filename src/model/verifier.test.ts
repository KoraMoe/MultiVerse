import { describe, test, expect, beforeEach } from "bun:test";
import { ethers } from 'ethers';
import { EthereumVerifier, signData } from './verifier';
import type { Ethereum } from './types';

describe('EthereumVerifier', () => {
  let verifier: EthereumVerifier;
  let wallet: ethers.HDNodeWallet;
  let address: Ethereum.Address;
  
  beforeEach(() => {
    // Create a new verifier and wallet for each test
    verifier = new EthereumVerifier();
    
    // Create a random wallet for testing
    wallet = ethers.Wallet.createRandom();
    address = wallet.address;
  });
  
  test('should correctly verify a valid signature', async () => {
    // Create test data
    const testData = { test: 'data', number: 123 };
    
    // Sign the data
    const signature = await signData(wallet.privateKey, testData);
    
    // Verify the signature
    const isValid = await verifier.verify(testData, signature, address);
    
    expect(isValid).toBe(true);
  });
  
  test('should reject an invalid signature', async () => {
    // Create test data
    const testData = { test: 'data', number: 123 };
    
    // Sign the data
    const signature = await signData(wallet.privateKey, testData);
    
    // Create a different wallet (different address)
    const differentWallet = ethers.Wallet.createRandom();
    const differentAddress = differentWallet.address;
    
    // Verify with the wrong address
    const isValid = await verifier.verify(testData, signature, differentAddress);
    
    expect(isValid).toBe(false);
  });
  
  test('should reject if data was tampered with', async () => {
    // Create test data
    const originalData = { test: 'data', number: 123 };
    
    // Sign the original data
    const signature = await signData(wallet.privateKey, originalData);
    
    // Tamper with the data
    const tamperedData = { test: 'data', number: 456 };
    
    // Verify with tampered data
    const isValid = await verifier.verify(tamperedData, signature, address);
    
    expect(isValid).toBe(false);
  });
  
  test('should handle different data types correctly', async () => {
    // Test with a string
    const stringData = "Hello, blockchain!";
    const stringSignature = await signData(wallet.privateKey, stringData);
    const stringValid = await verifier.verify(stringData, stringSignature, address);
    expect(stringValid).toBe(true);
    
    // Test with a number
    const numberData = 12345;
    const numberSignature = await signData(wallet.privateKey, numberData);
    const numberValid = await verifier.verify(numberData, numberSignature, address);
    expect(numberValid).toBe(true);
    
    // Test with a complex object
    const objectData = {
      name: "Test Object",
      values: [1, 2, 3],
      nested: {
        property: "value"
      }
    };
    const objectSignature = await signData(wallet.privateKey, objectData);
    const objectValid = await verifier.verify(objectData, objectSignature, address);
    expect(objectValid).toBe(true);
  });
}); 