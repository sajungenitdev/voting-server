import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.model.js';
import Poll from '../models/Poll.model.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Clear existing data
    await User.deleteMany({});
    await Poll.deleteMany({});
    
    // Create admin user
    const adminPassword = await bcrypt.hash('Admin123!', 12);
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@voting.com',
      password: adminPassword,
      role: 'admin',
      isVerified: true
    });
    
    console.log('Admin user created:', admin.email);
    
    // Create sample poll
    const samplePoll = await Poll.create({
      title: 'Sample Poll: Best Programming Language',
      description: 'Vote for your favorite programming language',
      category: 'technology',
      candidates: [
        { name: 'JavaScript', description: 'Web development' },
        { name: 'Python', description: 'Data science & AI' },
        { name: 'Java', description: 'Enterprise applications' }
      ],
      createdBy: admin._id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      isPublished: true
    });
    
    console.log('Sample poll created:', samplePoll.title);
    console.log('\n✅ Database seeded successfully!');
    console.log('\nTest credentials:');
    console.log('Admin Email: admin@voting.com');
    console.log('Admin Password: Admin123!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();