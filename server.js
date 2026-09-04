const express = require("express");
const path = require("path");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== SUPABASE CONFIGURATION ====================
// In production, these should be securely stored in process.env
const SUPABASE_URL = process.env.SUPABASE_URL || "https://yvcxxrkzlcdklzxetiin.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Y3h4cmt6bGNka2x6eGV0aWluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODQ5MDc2MiwiZXhwIjoyMTA0MDY2NzYyfQ.4U3A3Vaidm4RJen8uu43R3_UaI6BTxCqdZlh17arpPA";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BUCKET_NAME = "agreements";

// Automatically check/create the bucket on startup
(async () => {
    try {
        const { data: bucketData, error: bucketError } = await supabase.storage.getBucket(BUCKET_NAME);
        if (bucketError && bucketError.message.includes('not found')) {
            console.log(`Creating public Supabase bucket '${BUCKET_NAME}'...`);
            await supabase.storage.createBucket(BUCKET_NAME, { public: true });
            console.log(`Bucket '${BUCKET_NAME}' created successfully.`);
        } else if (bucketError) {
            console.error("Error checking Supabase bucket:", bucketError);
        } else {
            console.log(`Supabase bucket '${BUCKET_NAME}' found and ready.`);
        }
    } catch (e) {
        console.error("Failed to initialize Supabase bucket:", e);
    }
})();

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/contracts", express.static(path.join(__dirname, "build/contracts")));

// Configure Multer to use Memory Storage so we can stream files to Supabase
const upload = multer({ storage: multer.memoryStorage() });

// ==================== API ROUTES ====================

/**
 * POST /api/files/:agreementId/:context
 * Upload multiple files to Supabase Storage.
 */
app.post("/api/files/:agreementId/:context", upload.array("files"), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded." });
    }

    try {
        const { agreementId, context } = req.params;
        const uploadedNames = [];

        for (const file of req.files) {
            const filePath = `${agreementId}/${context}/${file.originalname}`;
            
            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: true // Overwrite if it already exists
                });

            if (error) {
                console.error(`Failed to upload ${file.originalname}:`, error);
                throw error;
            }
            uploadedNames.push(file.originalname);
        }

        res.json({
            success: true,
            uploaded: uploadedNames
        });
    } catch (err) {
        console.error("Error during upload:", err);
        res.status(500).json({ error: "Failed to upload files to Supabase." });
    }
});

/**
 * GET /api/files/:agreementId/:context
 * List all files for a given agreement and context.
 */
app.get("/api/files/:agreementId/:context", async (req, res) => {
    try {
        const { agreementId, context } = req.params;
        const folderPath = `${agreementId}/${context}`;

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list(folderPath);

        if (error) {
            console.error("Error listing files:", error);
            return res.json({ files: [] });
        }

        if (!data || data.length === 0) {
            return res.json({ files: [] });
        }

        // Exclude the placeholder folder marker if it exists (.emptyFolderPlaceholder)
        const items = data
            .filter(file => file.name !== '.emptyFolderPlaceholder')
            .map(file => {
                return {
                    name: file.name,
                    size: file.metadata?.size || 0,
                    mimeType: file.metadata?.mimetype || getMime(file.name),
                    url: `/api/files/${agreementId}/${context}/${encodeURIComponent(file.name)}`
                };
            });

        res.json({ files: items });
    } catch (err) {
        console.error("Error fetching file list:", err);
        res.json({ files: [] });
    }
});

/**
 * GET /api/files/:agreementId/:context/:filename
 * Download / view a specific file by redirecting to Supabase public URL.
 */
app.get("/api/files/:agreementId/:context/:filename", async (req, res) => {
    try {
        const { agreementId, context, filename } = req.params;
        const filePath = `${agreementId}/${context}/${decodeURIComponent(filename)}`;

        // Generate public URL
        const { data } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        if (data && data.publicUrl) {
            // Redirect the client to the Supabase public URL
            res.redirect(data.publicUrl);
        } else {
            res.status(404).json({ error: "File public URL not found." });
        }
    } catch (err) {
        console.error("Error generating public URL:", err);
        res.status(500).json({ error: "Failed to retrieve file." });
    }
});

/**
 * DELETE /api/files/:agreementId/:context/:filename
 * Delete a specific file from Supabase.
 */
app.delete("/api/files/:agreementId/:context/:filename", async (req, res) => {
    try {
        const { agreementId, context, filename } = req.params;
        const filePath = `${agreementId}/${context}/${decodeURIComponent(filename)}`;

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([filePath]);

        if (error) {
            console.error("Failed to delete file:", error);
            return res.status(500).json({ error: "Failed to delete file." });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Error deleting file:", err);
        res.status(500).json({ error: "Server error during deletion." });
    }
});

// ==================== MIME HELPER ====================
function getMime(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const map = {
        pdf:  "application/pdf",
        png:  "image/png",
        jpg:  "image/jpeg",
        jpeg: "image/jpeg",
        gif:  "image/gif",
        webp: "image/webp",
        svg:  "image/svg+xml",
        txt:  "text/plain",
        csv:  "text/csv",
        doc:  "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls:  "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        zip:  "application/zip",
    };
    return map[ext] || "application/octet-stream";
}

// ==================== START ====================
app.listen(PORT, () => {
    console.log(`Logistics Escrow dApp running at http://localhost:${PORT}`);
});
