const mongoose = require('mongoose');

const ocasionalUserSchema = new mongoose.Schema({
    mayoriaEdad: { type: Boolean, required: true }, 
}, { timestamps: true }); 

const OcasionalUser = mongoose.model('OcasionalUser', ocasionalUserSchema);

module.exports = OcasionalUser;