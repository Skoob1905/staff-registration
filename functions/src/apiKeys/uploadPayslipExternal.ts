import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { EmailProvider } from "../services/EmailService";

export const uploadPayslipExternal = onRequest({ region: "europe-west2" }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-API-Key");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  const apiKey = req.headers["x-api-key"];
  if (!apiKey || typeof apiKey !== "string") {
    res.status(401).json({ ok: false, error: "Missing X-API-Key header." });
    return;
  }

  const db = getFirestore();

  const keySnap = await db
    .collection("apiKeys")
    .where("apiKey", "==", apiKey)
    .limit(1)
    .get();

  if (keySnap.empty) {
    res.status(401).json({ ok: false, error: "Invalid API Key." });
    return;
  }

  const keyDoc = keySnap.docs[0];
  const keyData = keyDoc.data() as {
    expiresAt?: FirebaseFirestore.Timestamp;
  };

  if (!keyData.expiresAt || keyData.expiresAt.toDate() < new Date()) {
    res.status(403).json({
      ok: false,
      error: "Please request a new API Key to be created and sent",
    });
    return;
  }

  const isJson =
    (req.headers["content-type"] ?? "").toLowerCase().includes("application/json");

  let fileBuffer: Buffer;
  let fileName: string;
  let clientEmail: string;

  if (isJson) {
    const body = req.body ?? {};
    if (!body.fileBase64 || !body.fileName || !body.clientEmail) {
      res.status(400).json({
        ok: false,
        error: "fileBase64, fileName, and clientEmail are required.",
      });
      return;
    }
    fileBuffer = Buffer.from(body.fileBase64 as string, "base64");
    fileName = body.fileName as string;
    clientEmail = body.clientEmail as string;
  } else {
    clientEmail = (req.query.clientEmail as string) ?? "";
    fileName = (req.query.fileName as string) ?? "payslip.pdf";
    if (!clientEmail) {
      res.status(400).json({
        ok: false,
        error: "clientEmail query parameter is required.",
      });
      return;
    }

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Body stream timeout")), 10000);
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => { clearTimeout(timer); resolve(); });
      req.on("error", (e) => { clearTimeout(timer); reject(e); });
    });
    fileBuffer = Buffer.concat(chunks);

    if (fileBuffer.length === 0) {
      res.status(400).json({
        ok: false,
        error: "Request body is empty. Provide the PDF file as the raw request body.",
      });
      return;
    }
  }

  const staffSnap = await db
    .collection("staff")
    .where("email", "==", clientEmail.toLowerCase())
    .limit(1)
    .get();

  if (staffSnap.empty) {
    res.status(404).json({
      ok: false,
      error: "Staff member not found with that email.",
    });
    return;
  }

  const staffDoc = staffSnap.docs[0];
  const userId = staffDoc.id;

  const bucket = getStorage().bucket();
  const filePath = `payslips/${userId}/${fileName}`;
  const fileRef = bucket.file(filePath);

  const token =
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  await fileRef.save(fileBuffer, {
    metadata: {
      contentType: "application/pdf",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;

  const payslipRef = await db.collection("payslips").add({
    userId,
    agencyId: "",
    fileName,
    fileUrl,
    sentBy: keyDoc.get("label"),
    timestamp: FieldValue.serverTimestamp(),
    hasDownloaded: false,
  });

  const staffRef = db.collection("staff").doc(userId);
  const staffData = (await staffRef.get()).data() as
    | {
        metadata?: { payslipsSent?: string[] };
      }
    | undefined;
  const existing = staffData?.metadata?.payslipsSent ?? [];
  await staffRef.set(
    {
      metadata: {
        payslipsSent: [payslipRef.id, ...existing],
      },
    },
    { merge: true },
  );

  await keyDoc.ref.update({ lastUsedAt: FieldValue.serverTimestamp() });

  try {
    const emailProvider = new EmailProvider();
    await emailProvider.sentPayslip({ email: clientEmail });
  } catch (emailErr) {
    // best-effort: log and continue so upload still succeeds
    console.error("Failed to send payslip email", emailErr);
  }

  res.status(200).json({
    ok: true,
    payslipId: payslipRef.id,
    url: fileUrl,
  });
});
