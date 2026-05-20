const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const { v4: uuidv4 } = require("uuid");
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config();
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "videos";
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment.");
}

const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function getAuthedClient(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function extractToken(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim();
}

async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: "Token mancante" });
    }
    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: "Sessione non valida" });
    }
    req.user = data.user;
    req.token = token;
    req.supabase = getAuthedClient(token);
    next();
  } catch (err) {
    res.status(500).json({ error: "Errore autenticazione", details: err.message });
  }
}

const upload = multer({
  dest: path.join(__dirname, "uploads"),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
      "video/webm",
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

function generateThumbnail(videoPath, thumbPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .on("end", () => resolve(thumbPath))
      .on("error", (err) => reject(err))
      .screenshots({
        timestamps: ["1"],
        filename: path.basename(thumbPath),
        folder: path.dirname(thumbPath),
        size: "640x?",
      });
  });
}

function safeUnlink(filePath) {
  if (!filePath) return;
  fs.unlink(filePath, () => undefined);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "galaxy-social-api" });
});

app.get("/api/config", (_req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
  });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, username } = req.body;
    if (!email || !password || !username) {
      return res.status(400).json({ error: "email, password, username richiesti" });
    }
    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${APP_BASE_URL}/index.html`,
      },
    });
    if (error) return res.status(400).json({ error: error.message });
    if (data.user && data.session) {
      const authed = getAuthedClient(data.session.access_token);
      await authed.from("profiles").upsert({
        id: data.user.id,
        username,
      });
    }
    res.json({ user: data.user, session: data.session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email e password richiesti" });
    }
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ user: data.user, session: data.session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/magic-link", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "email richiesto" });
    const { error } = await supabaseAnon.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${APP_BASE_URL}/index.html` },
    });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/exchange", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "code richiesto" });
    const { data, error } = await supabaseAnon.auth.exchangeCodeForSession(code);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ session: data.session, user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/auth/google", async (_req, res) => {
  try {
    const { data, error } = await supabaseAnon.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${APP_BASE_URL}/index.html`,
      },
    });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ url: data.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stars", requireAuth, async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const q = (req.query.q || "").trim();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = req.supabase
      .from("stars")
      .select("id,name,color,x_coord,y_coord,created_by,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (q) query = query.ilike("name", `%${q}%`);

    const { data: stars, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });

    const starIds = (stars || []).map((s) => s.id);
    let countMap = {};
    if (starIds.length) {
      const { data: planetsRows, error: planetsErr } = await req.supabase
        .from("planets")
        .select("star_id")
        .in("star_id", starIds);
      if (!planetsErr && planetsRows) {
        countMap = planetsRows.reduce((acc, row) => {
          acc[row.star_id] = (acc[row.star_id] || 0) + 1;
          return acc;
        }, {});
      }
    }
    res.json({
      page,
      limit,
      total: count || 0,
      items: (stars || []).map((s) => ({
        ...s,
        planet_count: countMap[s.id] || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/stars", requireAuth, async (req, res) => {
  try {
    const { name, color, x_coord, y_coord } = req.body;
    if (!req.user?.id) {
      return res.status(401).json({ error: "Utente non autenticato" });
    }
    if (!name || name.length < 2) {
      return res.status(400).json({ error: "Nome stella non valido" });
    }
    const payload = {
      name: name.trim(),
      color: color || "#ffaa44",
      x_coord:
        typeof x_coord === "number" ? x_coord : Math.floor((Math.random() - 0.5) * 5000),
      y_coord:
        typeof y_coord === "number" ? y_coord : Math.floor((Math.random() - 0.5) * 5000),
      created_by: req.user.id,
    };
    const { data, error } = await req.supabase
      .from("stars")
      .insert(payload)
      .select("*")
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/planets", requireAuth, async (req, res) => {
  try {
    const starId = req.query.star_id;
    if (!starId) return res.status(400).json({ error: "star_id richiesto" });

    const { data: planets, error } = await req.supabase
      .from("planets")
      .select(
        "id,star_id,title,video_url,thumbnail_url,description,created_by,orbit_radius,orbit_speed,created_at"
      )
      .eq("star_id", starId)
      .order("created_at", { ascending: false });
    if (error) return res.status(400).json({ error: error.message });

    const planetIds = (planets || []).map((p) => p.id);
    const [likesRes, moonsRes, likedRes] = await Promise.all([
      planetIds.length
        ? req.supabase.from("likes").select("planet_id").in("planet_id", planetIds)
        : Promise.resolve({ data: [], error: null }),
      planetIds.length
        ? req.supabase.from("moons").select("planet_id").in("planet_id", planetIds)
        : Promise.resolve({ data: [], error: null }),
      planetIds.length
        ? req.supabase
            .from("likes")
            .select("planet_id")
            .in("planet_id", planetIds)
            .eq("user_id", req.user.id)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const likesMap = (likesRes.data || []).reduce((acc, row) => {
      acc[row.planet_id] = (acc[row.planet_id] || 0) + 1;
      return acc;
    }, {});
    const moonsMap = (moonsRes.data || []).reduce((acc, row) => {
      acc[row.planet_id] = (acc[row.planet_id] || 0) + 1;
      return acc;
    }, {});
    const likedSet = new Set((likedRes.data || []).map((r) => r.planet_id));

    res.json(
      (planets || []).map((p) => ({
        ...p,
        like_count: likesMap[p.id] || 0,
        moon_count: moonsMap[p.id] || 0,
        has_liked: likedSet.has(p.id),
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/planets", requireAuth, upload.single("video"), async (req, res) => {
  let videoTempPath = null;
  let thumbTempPath = null;
  try {
    const { star_id, title, description } = req.body;
    if (!star_id || !title) {
      safeUnlink(req.file?.path);
      return res.status(400).json({ error: "star_id e title richiesti" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "File video richiesto" });
    }

    videoTempPath = req.file.path;
    const ext = path.extname(req.file.originalname || ".mp4") || ".mp4";
    const videoStoragePath = `${req.user.id}/${uuidv4()}${ext}`;
    const fileBuffer = fs.readFileSync(videoTempPath);

    const { error: uploadErr } = await req.supabase.storage
      .from(STORAGE_BUCKET)
      .upload(videoStoragePath, fileBuffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });
    if (uploadErr) return res.status(400).json({ error: uploadErr.message });

    let thumbnailUrl = null;
    try {
      thumbTempPath = path.join(path.dirname(videoTempPath), `${uuidv4()}.jpg`);
      await generateThumbnail(videoTempPath, thumbTempPath);
      const thumbBuffer = fs.readFileSync(thumbTempPath);
      const thumbStoragePath = `${req.user.id}/thumb-${uuidv4()}.jpg`;
      const { error: thumbErr } = await req.supabase.storage
        .from(STORAGE_BUCKET)
        .upload(thumbStoragePath, thumbBuffer, {
          contentType: "image/jpeg",
          upsert: false,
        });
      if (!thumbErr) {
        const publicThumb = req.supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(thumbStoragePath);
        thumbnailUrl = publicThumb.data.publicUrl || null;
      }
    } catch (_) {
      thumbnailUrl = null;
    }

    const publicVideo = req.supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(videoStoragePath);
    const videoUrl = publicVideo.data.publicUrl;

    const { data, error } = await req.supabase
      .from("planets")
      .insert({
        star_id,
        title,
        description: description || null,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        created_by: req.user.id,
        orbit_radius: 100 + Math.floor(Math.random() * 200),
        orbit_speed: 0.00006 + Math.random() * 0.00014,
      })
      .select("*")
      .single();
    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    safeUnlink(videoTempPath);
    safeUnlink(thumbTempPath);
  }
});

app.get("/api/moons", requireAuth, async (req, res) => {
  try {
    const planetId = req.query.planet_id;
    if (!planetId) return res.status(400).json({ error: "planet_id richiesto" });
    const { data, error } = await req.supabase
      .from("moons")
      .select("id,planet_id,user_id,content,created_at")
      .eq("planet_id", planetId)
      .order("created_at", { ascending: false });
    if (error) return res.status(400).json({ error: error.message });

    const userIds = [...new Set((data || []).map((m) => m.user_id))];
    let profileMap = {};
    if (userIds.length) {
      const { data: profiles } = await req.supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", userIds);
      profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});
    }

    res.json(
      (data || []).map((m) => ({
        ...m,
        profile: profileMap[m.user_id] || null,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/moons", requireAuth, async (req, res) => {
  try {
    const { planet_id, content } = req.body;
    if (!planet_id || !content?.trim()) {
      return res.status(400).json({ error: "planet_id e content richiesti" });
    }
    const { data, error } = await req.supabase
      .from("moons")
      .insert({
        planet_id,
        content: content.trim(),
        user_id: req.user.id,
      })
      .select("*")
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/likes", requireAuth, async (req, res) => {
  try {
    const { planet_id } = req.body;
    if (!planet_id) return res.status(400).json({ error: "planet_id richiesto" });
    const { error } = await req.supabase.from("likes").insert({
      planet_id,
      user_id: req.user.id,
    });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      return res.status(400).json({ error: error.message });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/likes", requireAuth, async (req, res) => {
  try {
    const { planet_id } = req.body;
    if (!planet_id) return res.status(400).json({ error: "planet_id richiesto" });
    const { error } = await req.supabase
      .from("likes")
      .delete()
      .eq("planet_id", planet_id)
      .eq("user_id", req.user.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/user/profile", requireAuth, async (req, res) => {
  try {
    const [{ data: profile, error: profileErr }, { data: stars }, { data: planets }] =
      await Promise.all([
        req.supabase
          .from("profiles")
          .select("id,username,avatar_url,bio,created_at")
          .eq("id", req.user.id)
          .maybeSingle(),
        req.supabase.from("stars").select("id").eq("created_by", req.user.id),
        req.supabase.from("planets").select("id").eq("created_by", req.user.id),
      ]);
    if (profileErr) return res.status(400).json({ error: profileErr.message });

    const createdPlanetIds = (planets || []).map((p) => p.id);
    let likesReceived = 0;
    if (createdPlanetIds.length) {
      const { data: likesRows } = await req.supabase
        .from("likes")
        .select("id")
        .in("planet_id", createdPlanetIds);
      likesReceived = (likesRows || []).length;
    }

    res.json({
      profile,
      stats: {
        stars_created: (stars || []).length,
        planets_uploaded: (planets || []).length,
        likes_received: likesReceived,
      },
      user: {
        id: req.user.id,
        email: req.user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/user/profile", requireAuth, async (req, res) => {
  try {
    const { username, avatar_url, bio } = req.body;
    const updatePayload = {
      id: req.user.id,
      username: username || null,
      avatar_url: avatar_url || null,
      bio: bio || null,
    };
    const { data, error } = await req.supabase
      .from("profiles")
      .upsert(updatePayload)
      .select("id,username,avatar_url,bio,created_at")
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/app", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "app.html"));
});

app.get("/profile", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "profile.html"));
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File troppo grande. Limite: 100MB" });
    }
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: "Errore interno server", details: err.message });
});

app.listen(PORT, () => {
  console.log(`Galaxy Social server in ascolto su http://localhost:${PORT}`);
});
