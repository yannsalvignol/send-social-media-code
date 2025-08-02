import { Client, Databases, ID, Query, Users } from 'node-appwrite';
import { Resend } from 'resend';

// This Appwrite function will send social media verification codes
export default async ({ req, res, log, error }) => {
  let userData;

  try {

    let body;
    
    if (req.headers['content-type'] === 'application/json') {

      body = (req.body && Object.keys(req.body).length > 0) 
        ? req.body 
        : JSON.parse(req.payload || '{}');
    } else if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {

      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } else {
 
      body = JSON.parse(req.payload || '{}');
    }
      
    userData = body;

    if (!userData || !userData.userId) {
      error('Validation failed: User data not found in request body or payload.');
      return res.json({ ok: false, message: 'User data is required.' }, 400);
    }
  } catch (e) {
    error('Failed to parse request body/payload.', e);
    return res.json({ ok: false, message: 'Invalid request format.' }, 400);
  }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  const users = new Users(client);
 
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {

    const user = await users.get(userData.userId);
  
    const userDocs = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID,
      process.env.APPWRITE_USER_COLLECTION_ID,
      [Query.equal('creatoraccountid', userData.userId)]
    );

    if (userDocs.documents.length === 0) {
      error('User document not found in database.');
      return res.json({ ok: false, message: 'User document not found.' }, 404);
    }

    const userDoc = userDocs.documents[0];
    const socialMedia = userData.socialMedia || userDoc.social_media;
    const socialMediaUsername = userData.socialMediaUsername || userDoc.social_media_username;
    
    // Use the existing code from the database
    const existingCode = userDoc.social_media_number;
    
    if (!existingCode) {
      error('No verification code found for user.');
      return res.json({ ok: false, message: 'No verification code found.' }, 404);
    }

  
    const emailResult = await resend.emails.send({
      from: 'verification@email.cherrizbox.com',
      to: 'yannsalvignol@gmail.com',
      subject: `Social Media Verification Code - ${socialMedia}`,
      html: `
        <p><strong>Cherrizbox - Social Media Verification Code</strong></p>
        <p>User: ${user.name || 'Unknown'} (${user.email})</p>
        <p>Platform: ${socialMedia}</p>
        <p>Username: @${socialMediaUsername}</p>
        <p><strong>Verification Code: ${existingCode}</strong></p>
        <p>This code was requested by the user for social media verification.</p>
      `,
    });
    
    return res.json({ 
      ok: true, 
      message: 'Verification code sent successfully',
      code: existingCode
    });

  } catch (e) {
    error('FATAL: An exception occurred during social media code sending:', e);
    return res.json({ ok: false, message: 'An internal server error occurred.' }, 500);
  }
};
