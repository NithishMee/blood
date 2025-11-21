const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // Increased limit for image uploads
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'public'

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));

// Schemas
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePhoto: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    donations: [{ type: mongoose.Schema.Types.Mixed, default: [] }]
});

 

const bloodDonorSchema = new mongoose.Schema({
    name: String,
    phone: String,
    age: Number,
    weight: Number,
    bloodGroup: String,
    hasDonatedBefore: { type: Boolean, default: false },
    lastDonationDate: Date,
    latitude: Number,
    longitude: Number,
    verificationFile: String, // Store file path or URL if uploaded
    isVerified: { type: Boolean, default: false },
    verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNotes: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date }
});

const bloodReceiverSchema = new mongoose.Schema({
    name: String,
    phone: String,
    location: String,
    bloodNeed: String,
    latitude: Number,
    longitude: Number,
    proofFile: String,
    isVerified: { type: Boolean, default: false },
    verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNotes: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date },
    verificationFile: String
});

const organDonorSchema = new mongoose.Schema({
    name: String,
    phone: String,
    weight: Number,
    organType: String,
    conditionStatus: String,
    hasDonatedBefore: { type: Boolean, default: false },
    lastDonationDate: Date,
    latitude: Number,
    longitude: Number,
    verificationFile: String,
    isVerified: { type: Boolean, default: false },
    verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNotes: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date }
});

const organReceiverSchema = new mongoose.Schema({
    name: String,
    phone: String,
    location: String,
    organNeed: String,
    medicalCondition: String,
    latitude: Number,
    longitude: Number,
    proofFile: String,
    isVerified: { type: Boolean, default: false },
    verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNotes: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date },
    verificationFile: String
});

const moneyDonorSchema = new mongoose.Schema({
    donorName: String,
    amount: Number,
    paymentMethod: String,
    verificationFile: String,
    isVerified: { type: Boolean, default: false },
    verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNotes: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date },
    timestamp: { type: Date, default: Date.now }
});

const moneyReceiverSchema = new mongoose.Schema({
    name: String,
    age: Number,
    phone: String,
    moneyAmount: Number,
    moneyNeed: String,
    proofFile: String,
    verificationFile: String,
    isVerified: { type: Boolean, default: false },
    verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNotes: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date }
});

// Models
const User = mongoose.model('User', userSchema);
const BloodDonor = mongoose.model('BloodDonor', bloodDonorSchema);
const BloodReceiver = mongoose.model('BloodReceiver', bloodReceiverSchema);
const OrganDonor = mongoose.model('OrganDonor', organDonorSchema);
const OrganReceiver = mongoose.model('OrganReceiver', organReceiverSchema);
const MoneyDonor = mongoose.model('MoneyDonor', moneyDonorSchema);
const MoneyReceiver = mongoose.model('MoneyReceiver', moneyReceiverSchema);

// Utility: Check prior donations by phone and type (placed after models are defined)
app.get('/api/has-donated', async (req, res) => {
    try {
        const { phone, type } = req.query;
        if (!phone || !/^\d{10}$/.test(phone)) {
            return res.status(400).json({ error: 'Valid phone is required' });
        }
        if (!['blood', 'organ'].includes(type)) {
            return res.status(400).json({ error: 'type must be one of: blood, organ' });
        }

        let hasDonatedBefore = false;
        if (type === 'blood') {
            const count = await BloodDonor.countDocuments({ phone });
            hasDonatedBefore = count > 0;
        } else if (type === 'organ') {
            const count = await OrganDonor.countDocuments({ phone });
            hasDonatedBefore = count > 0;
        }

        res.json({ hasDonatedBefore });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Routes

// User Authentication Routes
// User Registration
app.post('/api/register', async (req, res) => {
    try {
        const { name, phone, password, profilePhoto } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this phone number already exists' });
        }
        
        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Create new user
        const user = new User({
            name,
            phone,
            password: hashedPassword,
            profilePhoto,
            donations: []
        });
        
        await user.save();
        
        // Return user data without password
        const userResponse = {
            _id: user._id,
            name: user.name,
            phone: user.phone,
            profilePhoto: user.profilePhoto,
            createdAt: user.createdAt,
            donations: user.donations
        };
        
        res.status(201).json({ 
            message: 'User registered successfully', 
            user: userResponse 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// User Login
app.post('/api/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        
        // Find user by phone number
        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(401).json({ error: 'Invalid phone number or password' });
        }
        
        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid phone number or password' });
        }
        
        // Return user data without password
        const userResponse = {
            _id: user._id,
            name: user.name,
            phone: user.phone,
            profilePhoto: user.profilePhoto,
            createdAt: user.createdAt,
            donations: user.donations
        };
        
        res.json({ 
            message: 'Login successful', 
            user: userResponse 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get User Profile
app.get('/api/user/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update User Profile
app.put('/api/user/:id', async (req, res) => {
    try {
        const { name, phone, profilePhoto } = req.body;
        
        // Check if phone number is already taken by another user
        if (phone) {
            const existingUser = await User.findOne({ phone, _id: { $ne: req.params.id } });
            if (existingUser) {
                return res.status(400).json({ error: 'Phone number already in use' });
            }
        }
        
        const updateData = {};
        if (name) updateData.name = name;
        if (phone) updateData.phone = phone;
        if (profilePhoto) updateData.profilePhoto = profilePhoto;
        
        const user = await User.findByIdAndUpdate(
            req.params.id, 
            updateData, 
            { new: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: 'Profile updated successfully', user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get All Users (for admin purposes)
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Blood Donor
app.post('/api/blood-donor', async (req, res) => {
    const { name, phone, age, weight, bloodGroup, hasDonatedBefore, lastDonationDate, latitude, longitude, userId, verificationFile } = req.body;
    try {
        // Server-side validations
        if (!name || !phone || !age || !weight || !bloodGroup) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (!/^\d{10}$/.test(phone)) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }
        const ageNum = Number(age);
        const weightNum = Number(weight);
        if (Number.isNaN(ageNum) || ageNum < 18 || ageNum > 65) {
            return res.status(400).json({ error: 'Age must be between 18 and 65' });
        }
        if (Number.isNaN(weightNum) || weightNum < 50) {
            return res.status(400).json({ error: 'Weight must be at least 50 kg' });
        }
        let lastDate = null;
        const donatedBefore = Boolean(hasDonatedBefore);
        if (donatedBefore) {
            if (!lastDonationDate) {
                return res.status(400).json({ error: 'Last donation date is required for previous donors' });
            }
            lastDate = new Date(lastDonationDate);
            if (isNaN(lastDate.getTime())) {
                return res.status(400).json({ error: 'Invalid last donation date' });
            }
            const diffDays = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < 90) {
                return res.status(400).json({ error: 'At least 90 days must have passed since the last donation' });
            }
        }

        const donor = new BloodDonor({ 
            name, 
            phone, 
            age: ageNum,
            weight: weightNum,
            bloodGroup, 
            hasDonatedBefore: donatedBefore,
            lastDonationDate: lastDate || undefined,
            latitude, 
            longitude, 
            verificationFile,
            verificationStatus: 'pending',
            submittedAt: new Date()
        });
        await donor.save();
        
        res.status(201).json({ 
            message: 'Blood donor registration submitted for verification', 
            donorId: donor._id,
            status: 'pending_verification'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/blood-donors', async (req, res) => {
    try {
        // Only return verified donors to regular users
        const donors = await BloodDonor.find({ verificationStatus: 'approved' });
        res.json(donors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get pending verifications
app.get('/api/admin/pending-verifications', async (req, res) => {
    try {
        const bloodDonors = await BloodDonor.find({ verificationStatus: 'pending' });
        const bloodReceivers = await BloodReceiver.find({ verificationStatus: 'pending' });
        const organDonors = await OrganDonor.find({ verificationStatus: 'pending' });
        const organReceivers = await OrganReceiver.find({ verificationStatus: 'pending' });
        const moneyDonors = await MoneyDonor.find({ verificationStatus: 'pending' });
        const moneyReceivers = await MoneyReceiver.find({ verificationStatus: 'pending' });

        res.json({
            bloodDonors,
            bloodReceivers,
            organDonors,
            organReceivers,
            moneyDonors,
            moneyReceivers
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get verification details
app.get('/api/admin/verification/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    
    if (!['blood-donor', 'blood-receiver', 'organ-donor', 'organ-receiver', 'money-donor', 'money-receiver'].includes(type)) {
        return res.status(400).json({ error: 'Invalid verification type' });
    }
    
    try {
        let model;
        switch (type) {
            case 'blood-donor':
                model = BloodDonor;
                break;
            case 'blood-receiver':
                model = BloodReceiver;
                break;
            case 'organ-donor':
                model = OrganDonor;
                break;
            case 'organ-receiver':
                model = OrganReceiver;
                break;
            case 'money-donor':
                model = MoneyDonor;
                break;
            case 'money-receiver':
                model = MoneyReceiver;
                break;
        }
        
        const item = await model.findById(id);
        if (!item) {
            return res.status(404).json({ error: 'Verification not found' });
        }
        
        res.json(item);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Verify submission
app.post('/api/admin/verify', async (req, res) => {
    const { type, id, status, notes } = req.body;
    
    if (!['blood-donor', 'blood-receiver', 'organ-donor', 'organ-receiver', 'money-donor', 'money-receiver'].includes(type)) {
        return res.status(400).json({ error: 'Invalid verification type' });
    }
    
    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    
    try {
        let model;
        let updateData = {
            verificationStatus: status,
            verifiedAt: new Date(),
            isVerified: status === 'approved',
            adminNotes: notes || ''
        };
        
        switch (type) {
            case 'blood-donor':
                model = BloodDonor;
                break;
            case 'blood-receiver':
                model = BloodReceiver;
                break;
            case 'organ-donor':
                model = OrganDonor;
                break;
            case 'organ-receiver':
                model = OrganReceiver;
                break;
            case 'money-donor':
                model = MoneyDonor;
                break;
            case 'money-receiver':
                model = MoneyReceiver;
                break;
        }
        
        const updated = await model.findByIdAndUpdate(id, updateData, { new: true });
        
        if (!updated) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        res.json({ 
            message: `Verification ${status} successfully`,
            record: updated
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Blood Receiver
app.post('/api/blood-receiver', async (req, res) => {
    const { name, phone, location, bloodNeed, latitude, longitude, verificationFile } = req.body;
    try {
        const receiver = new BloodReceiver({ 
            name, 
            phone, 
            location, 
            bloodNeed, 
            latitude, 
            longitude,
            verificationFile,
            verificationStatus: 'pending',
            submittedAt: new Date()
        });
        
        await receiver.save();
        
        res.status(201).json({ 
            message: 'Blood receiver registration submitted for verification. Donor details will be available once an admin approves your request.',
            receiverId: receiver._id,
            status: 'pending_verification'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/blood-receiver/matching-donors', async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone || !/^\d{10}$/.test(phone)) {
            return res.status(400).json({ error: 'Valid phone number is required' });
        }

        const receiver = await BloodReceiver.findOne({ phone, verificationStatus: 'approved' })
            .sort({ verifiedAt: -1, submittedAt: -1 });

        if (!receiver) {
            const latest = await BloodReceiver.findOne({ phone }).sort({ submittedAt: -1 });
            if (!latest) {
                return res.status(404).json({ error: 'Receiver registration not found. Please register first.' });
            }
            return res.status(403).json({
                status: latest.verificationStatus,
                message: 'Receiver has not been approved yet. Please wait for admin verification.'
            });
        }

        const matchingDonors = await BloodDonor.find({ 
            bloodGroup: receiver.bloodNeed,
            verificationStatus: 'approved'
        });

        return res.json({
            message: 'Receiver verified. Showing available donors.',
            receiver: {
                name: receiver.name,
                phone: receiver.phone,
                bloodNeed: receiver.bloodNeed,
                location: receiver.location,
                latitude: receiver.latitude,
                longitude: receiver.longitude
            },
            donors: matchingDonors
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Organ Donor
app.post('/api/organ-donor', async (req, res) => {
    const { name, phone, organType, conditionStatus, weight, hasDonatedBefore, lastDonationDate, latitude, longitude, userId, verificationFile } = req.body;
    try {
        // Server-side validations
        if (!name || !phone || !organType || !conditionStatus || !weight) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (!/^\d{10}$/.test(phone)) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }
        const weightNum = Number(weight);
        if (Number.isNaN(weightNum) || weightNum < 50) {
            return res.status(400).json({ error: 'Weight must be at least 50 kg' });
        }
        let lastDate = null;
        const donatedBefore = Boolean(hasDonatedBefore);
        if (donatedBefore) {
            if (!lastDonationDate) {
                return res.status(400).json({ error: 'Last donation date is required for previous donors' });
            }
            lastDate = new Date(lastDonationDate);
            if (isNaN(lastDate.getTime())) {
                return res.status(400).json({ error: 'Invalid last donation date' });
            }
            const diffDays = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < 90) {
                return res.status(400).json({ error: 'At least 90 days must have passed since the last donation' });
            }
        }

        const donor = new OrganDonor({ 
            name, 
            phone, 
            organType, 
            conditionStatus, 
            weight: weightNum,
            hasDonatedBefore: donatedBefore,
            lastDonationDate: lastDate || undefined,
            latitude, 
            longitude,
            verificationFile,
            verificationStatus: 'pending',
            submittedAt: new Date()
        });
        
        await donor.save();
        
        // If user is signed in, add donation to user's donations array
        if (userId) {
            const user = await User.findById(userId);
            if (user) {
                user.donations.push({
                    type: 'organ',
                    donorId: donor._id,
                    name: donor.name,
                    phone: donor.phone,
                    organType: donor.organType,
                    conditionStatus: donor.conditionStatus,
                    timestamp: new Date(),
                    status: 'pending_verification'
                });
                await user.save();
            }
        }
        
        res.status(201).json({ 
            message: 'Organ donor registration submitted for verification',
            donorId: donor._id,
            status: 'pending_verification'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/organ-donors', async (req, res) => {
    try {
        const donors = await OrganDonor.find();
        res.json(donors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Organ Receiver
app.post('/api/organ-receiver', async (req, res) => {
    const { name, phone, location, organNeed, medicalCondition, latitude, longitude, verificationFile } = req.body;
    try {
        const receiver = new OrganReceiver({ 
            name, 
            phone, 
            location, 
            organNeed, 
            medicalCondition, 
            latitude, 
            longitude,
            verificationFile,
            verificationStatus: 'pending',
            submittedAt: new Date()
        });
        
        await receiver.save();
        
        res.status(201).json({ 
            message: 'Organ receiver registration submitted for verification. Donor details will be available once an admin approves your request.',
            receiverId: receiver._id,
            status: 'pending_verification'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/organ-receiver/matching-donors', async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone || !/^\d{10}$/.test(phone)) {
            return res.status(400).json({ error: 'Valid phone number is required' });
        }

        const receiver = await OrganReceiver.findOne({ phone, verificationStatus: 'approved' })
            .sort({ verifiedAt: -1, submittedAt: -1 });

        if (!receiver) {
            const latest = await OrganReceiver.findOne({ phone }).sort({ submittedAt: -1 });
            if (!latest) {
                return res.status(404).json({ error: 'Receiver registration not found. Please register first.' });
            }
            return res.status(403).json({ 
                status: latest.verificationStatus,
                message: 'Receiver has not been approved yet. Please wait for admin verification.'
            });
        }

        const matchingDonors = await OrganDonor.find({ 
            organType: receiver.organNeed,
            verificationStatus: 'approved'
        });

        return res.json({
            message: 'Receiver verified. Showing available donors.',
            receiver: {
                name: receiver.name,
                phone: receiver.phone,
                organNeed: receiver.organNeed,
                location: receiver.location,
                latitude: receiver.latitude,
                longitude: receiver.longitude,
                medicalCondition: receiver.medicalCondition
            },
            donors: matchingDonors
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Money Donor
app.post('/api/money-donor', async (req, res) => {
    const { donorName, amount, paymentMethod, userId, verificationFile } = req.body;
    try {
        const donor = new MoneyDonor({ 
            donorName, 
            amount, 
            paymentMethod,
            verificationFile,
            verificationStatus: 'pending',
            submittedAt: new Date()
        });
        
        await donor.save();
        
        // If user is signed in, add donation to user's donations array
        if (userId) {
            const user = await User.findById(userId);
            if (user) {
                user.donations.push({
                    type: 'money',
                    donorId: donor._id,
                    name: donor.donorName,
                    amount: donor.amount,
                    paymentMethod: donor.paymentMethod,
                    timestamp: new Date(),
                    status: 'pending_verification'
                });
                await user.save();
            }
        }
        
        res.status(201).json({ 
            message: 'Money donation submitted for verification',
            donorId: donor._id,
            status: 'pending_verification'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Money Receiver
app.post('/api/money-receiver', async (req, res) => {
    const { name, age, phone, moneyAmount, moneyNeed, verificationFile } = req.body;
    try {
        const receiver = new MoneyReceiver({ 
            name, 
            age, 
            phone, 
            moneyAmount, 
            moneyNeed,
            verificationFile,
            verificationStatus: 'pending',
            submittedAt: new Date()
        });
        
        await receiver.save();
        
        res.status(201).json({ 
            message: 'Money receiver registration submitted for verification',
            receiverId: receiver._id,
            status: 'pending_verification'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve HTML pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));
app.get('/blooddonor.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'blooddonor.html')));
app.get('/bloodreceiver.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'bloodreceiver.html')));
app.get('/moneydonor.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'moneydonor.html')));
app.get('/moneyreceiver.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'moneyreceiver.html')));
app.get('/organdonor.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'organdonor.html')));
app.get('/organreceiver.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'organreceiver.html')));
app.get('/signup.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/profile.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'profile.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/about.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'about.html')));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`server is running on http://localhost:${PORT}`));