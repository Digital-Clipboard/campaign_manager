#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;

const mailjetAuth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

async function getContactsWithEmails(contactIds) {
  const contacts = [];
  
  // Fetch contacts in batches to get email addresses
  console.log(`   Fetching email addresses for ${contactIds.length} contacts...`);
  
  for (let i = 0; i < contactIds.length; i++) {
    try {
      const response = await axios.get(
        `https://api.mailjet.com/v3/REST/contact/${contactIds[i]}`,
        {
          headers: {
            'Authorization': `Basic ${mailjetAuth}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      contacts.push({
        ContactID: response.data.Data[0].ID,
        Email: response.data.Data[0].Email
      });
      
      if ((i + 1) % 100 === 0) {
        console.log(`   Fetched ${i + 1}/${contactIds.length} contacts...`);
      }
      
      // Rate limiting
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      console.error(`   ⚠️ Error fetching contact ${contactIds[i]}: ${error.message}`);
    }
  }
  
  return contacts;
}

async function getAllContactIdsFromList(listId) {
  let allContacts = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const response = await axios.get(
      `https://api.mailjet.com/v3/REST/listrecipient?ContactsList=${listId}&Limit=${limit}&Offset=${offset}`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const contacts = response.data.Data;
    allContacts = allContacts.concat(contacts);
    
    console.log(`   Fetched ${contacts.length} contact IDs (total so far: ${allContacts.length})`);

    if (contacts.length < limit) break;
    offset += limit;
  }

  return allContacts;
}

async function addContactsToListByEmail(listId, contacts) {
  const batchSize = 100;
  
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    const contactsPayload = batch.map(c => ({ Email: c.Email }));

    console.log(`   Uploading batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(contacts.length / batchSize)} (${batch.length} contacts)...`);

    try {
      const response = await axios.post(
        `https://api.mailjet.com/v3/REST/contactslist/${listId}/managemanycontacts`,
        {
          Action: 'addnoforce',
          Contacts: contactsPayload
        },
        {
          headers: {
            'Authorization': `Basic ${mailjetAuth}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`   ✅ Batch uploaded. Job ID: ${response.data.Data[0]?.JobID || 'N/A'}`);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`   ❌ Error uploading batch: ${error.response?.data?.ErrorMessage || error.message}`);
    }
  }
}

async function uploadRound2ContactsWithEmails() {
  console.log('📤 Uploading Round 2 contacts WITH EMAIL ADDRESSES');
  console.log('='.repeat(80));
  console.log('⚠️ This will take 5-10 minutes due to rate limiting');
  console.log('');

  // Step 1: Fetch all contact IDs from master list
  console.log('Step 1: Fetching contact IDs from master list...');
  const allContacts = await getAllContactIdsFromList(5776);
  console.log(`✅ Total contacts fetched: ${allContacts.length}`);

  // Step 2: Sort by Contact ID
  console.log('\nStep 2: Sorting contacts by Contact ID...');
  allContacts.sort((a, b) => a.ContactID - b.ContactID);

  // Step 3: Extract users 1,001-2,000
  console.log('\nStep 3: Extracting users 1,001-2,000...');
  const round2ContactIds = allContacts.slice(1000, 2000).map(c => c.ContactID);
  console.log(`   ✅ Extracted ${round2ContactIds.length} contact IDs for Round 2`);

  // Step 4: Fetch email addresses for these contacts
  console.log('\nStep 4: Fetching email addresses for Round 2 contacts...');
  const round2ContactsWithEmails = await getContactsWithEmails(round2ContactIds);
  console.log(`✅ Retrieved ${round2ContactsWithEmails.length} contacts with emails`);

  // Step 5: Upload to list 10503118
  console.log('\nStep 5: Uploading contacts to list 10503118...');
  await addContactsToListByEmail(10503118, round2ContactsWithEmails);

  console.log('\n✅ UPLOAD COMPLETE!');
  console.log('⏳ Wait 1-2 minutes for MailJet to process');
  console.log('   Then run: node scripts/verify-round2-list.js');
}

uploadRound2ContactsWithEmails().catch(console.error);
