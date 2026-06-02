import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

const WEB_API_KEY = "AIzaSyB6oPbRDz2RGXnVoBhfPNn710afIGc3w4Y";
const PROJECT_ID = "handysign-ab77f";

const saKey = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf-8"));
const app = initializeApp({ credential: cert(saKey), projectId: PROJECT_ID });

const token = await getAuth(app).createCustomToken("backfill-script");
console.log("Custom token created, exchanging for ID token...");

const resp = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, returnSecureToken: true }),
  }
);
const data = await resp.json();
if (!data.idToken) {
  console.error("Failed to get ID token:", JSON.stringify(data));
  process.exit(1);
}

console.log("Got ID token, calling backfill function...");

const result = await fetch(
  `https://europe-west2-${PROJECT_ID}.cloudfunctions.net/backfillAlgoliaIndices`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.idToken}`,
    },
    body: JSON.stringify({ data: {} }),
  }
);

const text = await result.text();
console.log(text);
