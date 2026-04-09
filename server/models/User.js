const mongoose = require("mongoose");


const userSchema = new mongoose.Schema(
  {
    // ─── Google Profile ──────────────────────────────────────────
    googleId: {
      type: String,
      required: [true, "Google ID is required"],
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    profilePicture: {
      type: String,
      default: null,
    },

    // ─── OAuth Tokens (AES-256 encrypted) ───────────────────────
    // These are ALWAYS stored encrypted. Never plain text.
    // Use tokenService.js to read/write — never access directly.
    tokens: {
      accessToken: {
        type: String,
        required: true,
      },
      refreshToken: {
        type: String,
        required: true,
      },
      tokenExpiry: {
        type: Date,
        required: true,
      },
      // Track what Drive scopes were actually granted by the user.
      // If user only granted partial permissions, we know why certain commands fail.
      scopes: {
        type: [String],
        default: [],
      },
    },

    // ─── Re-auth Flag ─────────────────────────────────────────────
    // Set to true when refresh token fails (revoked or user removed our app).
    // When true, bot sends "Please re-login at <url>" instead of crashing.
    requiresReAuth: {
      type: Boolean,
      default: false,
    },

    // ─── WhatsApp ─────────────────────────────────────────────────
    // whatsappNumber = the USER's own WhatsApp number (we learn this from
    // the first message they send us). e.g., "whatsapp:+919876543210"
    whatsappNumber: {
      type: String,
      default: null,
      index: true, // Queried on EVERY incoming WhatsApp message
      sparse: true, // Only index non-null values
    },
    // twilioNumber = our bot number assigned to this user
    twilioNumber: {
      type: String,
      default: null,
    },
    // Track when user first linked their WhatsApp
    whatsappLinkedAt: {
      type: Date,
      default: null,
    },

    // ─── Usage Stats ──────────────────────────────────────────────
    // Lightweight counters — useful for admin dashboard & abuse detection
    stats: {
      totalCommands: { type: Number, default: 0 },
      totalUploads: { type: Number, default: 0 },
      totalDeletes: { type: Number, default: 0 },
      lastCommandAt: { type: Date, default: null },
    },

    // ─── Account Status ───────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    deactivatedReason: {
      type: String,
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },

    // ─── Onboarding ───────────────────────────────────────────────
    hasCompletedOnboarding: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// ─── Indexes ─────────────────────────────────────────────────────
// Compound index: most common query in the whatsapp webhook handler
userSchema.index({ whatsappNumber: 1, isActive: 1 });

// ─── Pre-save Hook ────────────────────────────────────────────────
// Automatically updates lastActiveAt on every save
userSchema.pre("save", function (next) {
  this.lastActiveAt = new Date();
  next();
});

// ─── Instance Methods ─────────────────────────────────────────────

/**
 * Check if access token is expired or expiring within 5 minutes.
 * Guards against missing tokenExpiry (edge case: data corruption).
 */
userSchema.methods.isTokenExpired = function () {
  if (!this.tokens || !this.tokens.tokenExpiry) return true;
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return this.tokens.tokenExpiry <= fiveMinutesFromNow;
};

/**
 * Increment a usage stat counter after a successful command.
 * @param {"totalUploads"|"totalDeletes"} type - specific stat to bump (optional)
 */
userSchema.methods.incrementStat = async function (type = null) {
  return User.findByIdAndUpdate(this._id, {
    $inc: {
      "stats.totalCommands": 1,
      ...(type && { [`stats.${type}`]: 1 }),
    },
    "stats.lastCommandAt": new Date(),
    lastActiveAt: new Date(),
  });
};

userSchema.methods.flagReAuth = async function () {
  return User.findByIdAndUpdate(this._id, {
    requiresReAuth: true,
    lastActiveAt: new Date(),
  });
};

// ─── Static Methods ───────────────────────────────────────────────

/**
 * Find active user by their WhatsApp number.
 * Most frequently called query in the entire app.
 */
userSchema.statics.findByWhatsApp = function (number) {
  return this.findOne({ whatsappNumber: number, isActive: true });
};

// ─── toJSON Transform ─────────────────────────────────────────────
// Strips sensitive fields from any JSON response automatically.
// Even if a controller accidentally returns the full user object,
// tokens will NEVER appear in the API response.
userSchema.set("toJSON", {
  transform: function (doc, ret) {
    delete ret.tokens;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model("User", userSchema);
module.exports = User;
