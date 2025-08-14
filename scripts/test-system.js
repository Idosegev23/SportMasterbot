#!/usr/bin/env node
// Test script for SportMaster system
// Run with: node scripts/test-system.js

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testSystemAPI() {
console.log('🧪 Testing SportMaster System...\n');

  const tests = [
    {
      name: 'System Status',
      method: 'GET',
      url: '/api/status',
      expectedStatus: 200
    },
    {
      name: 'Start System',
      method: 'POST', 
      url: '/api/start',
      expectedStatus: 200
    },
    {
      name: 'Manual Predictions',
      method: 'POST',
      url: '/api/manual/predictions',
      expectedStatus: 200
    },
    {
      name: 'Manual Promo',
      method: 'POST',
      url: '/api/manual/promo',
      data: { promoType: 'football' },
      expectedStatus: 200
    },
    {
      name: 'Analytics',
      method: 'GET',
      url: '/api/analytics',
      expectedStatus: 200
    }
  ];

  for (const test of tests) {
    try {
      console.log(`🔍 Testing: ${test.name}`);
      
      const config = {
        method: test.method,
        url: `${BASE_URL}${test.url}`,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (test.data) {
        config.data = test.data;
      }

      const response = await axios(config);
      
      if (response.status === test.expectedStatus) {
        console.log(`✅ ${test.name}: PASSED (${response.status})`);
        if (response.data?.message) {
          console.log(`   📝 ${response.data.message}`);
        }
      } else {
        console.log(`❌ ${test.name}: FAILED (Expected ${test.expectedStatus}, got ${response.status})`);
      }
      
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR`);
      console.log(`   💬 ${error.response?.data?.message || error.message}`);
    }
    
    console.log(''); // Empty line for readability
  }

  console.log('🏁 Testing completed!\n');
}

// Run tests if called directly
if (require.main === module) {
  testSystemAPI();
}

module.exports = { testSystemAPI };