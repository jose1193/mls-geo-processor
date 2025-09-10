#!/usr/bin/env node

// Script para testear la API de Railway desde localhost
const BASE_URL = 'https://mls-geo-processor-production.up.railway.app';

async function testEndpoint(endpoint, data = null) {
  try {
    console.log(`\n🧪 Testing: ${endpoint}`);
    
    const options = {
      method: data ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Railway-Test-Script/1.0'
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const result = await response.text();
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
    
    try {
      const jsonResult = JSON.parse(result);
      console.log(`Response:`, JSON.stringify(jsonResult, null, 2));
    } catch {
      console.log(`Response (text):`, result);
    }
    
    return { success: response.ok, status: response.status, data: result };
  } catch (error) {
    console.error(`❌ Error testing ${endpoint}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log(`🚀 Testing Railway deployment: ${BASE_URL}`);
  console.log(`📅 ${new Date().toISOString()}`);
  
  // Test 1: Debug endpoint
  await testEndpoint('/api/debug');
  
  // Test 2: Keepalive
  await testEndpoint('/api/keepalive');
  
  // Test 3: Send OTP (esto debería fallar con el error que estás viendo)
  await testEndpoint('/api/auth/send-otp', {
    email: 'geocodingmls@gmail.com'
  });
  
  console.log(`\n✅ Testing completed`);
}

runTests().catch(console.error);
