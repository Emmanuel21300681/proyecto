const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');
const Group = require('../models/Group');
const User = require('../models/User');

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Crear grupo
router.post('/create', upload.single('imagen'), async (req, res) => {
  try {
    const { name, description, creatorEmail, tags } = req.body;

    if (!name || !creatorEmail) {
      return res.status(400).json({ success: false, message: 'Nombre y email del creador son obligatorios.' });
    }

    const user = await User.findOne({ email: creatorEmail });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    let imageUrl = '';
    if (req.file) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { resource_type: 'image' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });
        imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error('Error subiendo imagen a Cloudinary:', uploadError);
        return res.status(500).json({ success: false, message: 'Error al subir la imagen.' });
      }
    }

    const group = new Group({
      name,
      description: description || '',
      image: imageUrl,
      creatorId: user._id,
      members: [user._id],
      tags: tags ? tags.split(',') : [],
      createdAt: new Date()
    });

    await group.save();

    res.status(201).json({ success: true, groupId: group._id });
  } catch (error) {
    console.error('Error creando grupo:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

// Obtener grupos de un usuario
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const groups = await Group.find({ members: userId });
    res.json(groups);
  } catch (error) {
    console.error('Error obteniendo grupos:', error);
    res.status(500).json({ error: 'Error obteniendo grupos' });
  }
});

// Obtener grupo específico por ID
router.get('/id/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }
    res.json(group);
  } catch (error) {
    console.error('Error obteniendo grupo:', error);
    res.status(500).json({ error: 'Error obteniendo grupo' });
  }
});

// Obtener todos los grupos
router.get('/', async (req, res) => {
  try {
    const groups = await Group.find();
    res.json(groups);
  } catch (error) {
    console.error('Error obteniendo todos los grupos:', error);
    res.status(500).json({ error: 'Error obteniendo grupos' });
  }
});

// Eliminar grupo
router.post('/:groupId/delete', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { creatorId } = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    if (group.creatorId.toString() !== creatorId) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este grupo' });
    }

    await Group.deleteOne({ _id: groupId });
    res.json({ success: true, message: 'Grupo eliminado' });
  } catch (error) {
    console.error('Error eliminando grupo:', error);
    res.status(500).json({ error: 'Error eliminando grupo' });
  }
});

module.exports = router;