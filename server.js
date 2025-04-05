// server.js
require("dotenv").config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const nodemailer = require("nodemailer");
const cors = require('cors');
const crypto = require("crypto");
 // Adjust the path to your User model
const router = express.Router();
const jwt = require('jsonwebtoken');
require('dotenv').config();
const path = require('path');
const app = express();


// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/music', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));

// User Schema
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', UserSchema);

// Signup API
app.post('/api/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'Username or email already exists' 
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword
    });
    
    await newUser.save();
    
    res.status(201).json({
      success: true,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});




// Login API endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Login attempt with email:', email);
    // 1. Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }
    
    // 2. Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }
    
    // 3. Create JWT token (install jsonwebtoken package)
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
      
    );

   
    
      // Log the user info to ensure it's correct
      console.log('User found:', user);
      console.log('Returning success response with token and user data');
    
  
    
    // 4. Return user data (without password) and token
    const userData = {
      _id: user._id,
      username: user.username,
      email: user.email
    };
    
    res.json({
      success: true,
      token,
      user: userData
    
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});





// API Endpoint to send reset link
// Transporter setup (Use your email provider)
const transporter = nodemailer.createTransport({
  service: "gmail", // Use "gmail" (case-sensitive)
  auth: {
    user: "vikasssakkargi@gmail.com", // Your Gmail address
    pass: "gjll qncd wkto trou", // Use the App Password (not your Gmail password)
  },
});

// Reset password endpoint
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = resetToken;
    user.tokenExpiration = Date.now() + 3600000; // Token expires in 1 hour
    await user.save();

    const resetLink = `${req.protocol}://${req.get('host')}/login-page/forgot-password.html?token=${resetToken}`;

    // Send reset password email
    await transporter.sendMail({
      from: "vikasssakkargi@gmail.com",
      to: user.email,
      subject: "Password Reset",
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`,
    }) .then(info => {
      console.log("Email sent: " + info.response);
      res.json({ message: "Reset link sent to your email", color: "green" });
    }).catch(error => {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Error sending reset email", color: "red" });
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get('/login-page/forgot-password.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login-page', 'reset-password.html'));
});


// Playlist functionality
// In your server.js or auth routes
// Serve static files with multiple fallbacks

router.post('/api/reset-password.html', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Always return JSON - even for errors
    if (!token || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: "Token and password are required" 
      });
    }

    const user = await User.findOne({ 
      resetToken: token,
      tokenExpiration: { $gt: Date.now() }
    });

    

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    // Update password
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = undefined;
    user.tokenExpiration = undefined;
    await user.save();

    res.json({ 
      success: true,
      message: "Password updated successfully" 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});





// MongoDB Connection


// Update user profile
app.put('/update-profile', async (req, res) => {
  const { email, fullName, username, gender, avatar } = req.body;

  try {
    const updatedUser = await User.findOneAndUpdate(
      { email }, // Find by email
      { fullName, username, gender, avatar }, // Update fields
      { new: true } // Return updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error });
  }
});

// Array to store playlist songs
let playlist = [];

// Function to add a song to the playlist
function addToPlaylist(songTitle, songArtist) {
    const song = {
        title: songTitle,
        artist: songArtist,
    };
    playlist.push(song);
    updatePlaylistUI();
}

// Function to update the playlist UI
function updatePlaylistUI() {
    playlistSongs.innerHTML = "";
    playlist.forEach((song, index) => {
        const songItem = document.createElement("div");
        songItem.className = "song-item";
        songItem.innerHTML = `
            <span>${song.title} - ${song.artist}</span>
            <button onclick="removeFromPlaylist(${index})">Remove</button>
        `;
        
    });
}

// Function to remove a song from the playlist
function removeFromPlaylist(index) {
    playlist.splice(index, 1);
    updatePlaylistUI();
}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));






