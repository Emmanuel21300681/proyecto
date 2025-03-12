const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: false },
  image: { type: String, default: '' },
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  tags: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Group = mongoose.model('Group', GroupSchema);
module.exports = Group;