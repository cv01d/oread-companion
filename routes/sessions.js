import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import mcpClient from '../services/mcpClient.js';

const router = express.Router();

// Create new session
router.post('/', async (req, res) => {
  try {
    const { name, settings } = req.body;
    const sessionId = uuidv4();

    const mode = settings.mode || 'normal';
    const characterName = mode === 'roleplay'
      ? settings.roleplay?.singleCharacter?.identity?.name
      : null;
    const characterMode = mode === 'roleplay'
      ? settings.roleplay?.characterMode
      : 'utility';

    // Insert session via MCP
    await mcpClient.executeSQLite(
      `INSERT INTO sessions (id, name, character_name, character_mode, mode, settings_snapshot)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        name || `${characterName || 'Utility'} Session`,
        characterName,
        characterMode,
        mode,
        JSON.stringify(settings)
      ]
    );

    // Get the created session
    const sessions = await mcpClient.querySQLite(
      'SELECT * FROM sessions WHERE id = ?',
      [sessionId]
    );

    res.json({
      success: true,
      session: sessions[0]
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List sessions
router.get('/', async (req, res) => {
  try {
    const { archived = 'false', limit = '50', offset = '0' } = req.query;

    const sessions = await mcpClient.querySQLite(
      `SELECT * FROM sessions
       WHERE archived = ?
       ORDER BY updated_at DESC
       LIMIT ? OFFSET ?`,
      [archived === 'true' ? 1 : 0, parseInt(limit), parseInt(offset)]
    );

    const countResult = await mcpClient.querySQLite(
      'SELECT COUNT(*) as count FROM sessions WHERE archived = ?',
      [archived === 'true' ? 1 : 0]
    );

    const total = countResult[0]?.count || 0;

    res.json({
      success: true,
      sessions,
      total,
      has_more: parseInt(offset) + sessions.length < total
    });
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get session by ID
router.get('/:id', async (req, res) => {
  try {
    const sessions = await mcpClient.querySQLite(
      'SELECT * FROM sessions WHERE id = ?',
      [req.params.id]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessions[0];
    if (session.settings_snapshot) {
      session.settings_snapshot = JSON.parse(session.settings_snapshot);
    }

    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update session
router.put('/:id', async (req, res) => {
  try {
    const { name, archived } = req.body;
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (archived !== undefined) {
      updates.push('archived = ?');
      params.push(archived ? 1 : 0);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    await mcpClient.executeSQLite(
      `UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const sessions = await mcpClient.querySQLite(
      'SELECT * FROM sessions WHERE id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      session: sessions[0]
    });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete session
router.delete('/:id', async (req, res) => {
  try {
    await mcpClient.executeSQLite(
      'DELETE FROM sessions WHERE id = ?',
      [req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save message to session
router.post('/:id/messages', async (req, res) => {
  try {
    const { role, content, model, system_prompt_hash, timestamp } = req.body;
    const messageId = uuidv4();

    await mcpClient.executeSQLite(
      `INSERT INTO messages (id, session_id, role, content, model, system_prompt_hash, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        messageId,
        req.params.id,
        role,
        content,
        model || null,
        system_prompt_hash || null,
        timestamp || new Date().toISOString()
      ]
    );

    // Update session stats
    await mcpClient.executeSQLite(
      `UPDATE sessions
       SET message_count = message_count + 1,
           last_message_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.params.id]
    );

    res.json({
      success: true,
      message: {
        id: messageId,
        session_id: req.params.id,
        role,
        content,
        timestamp: timestamp || new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Save message error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get messages for session
router.get('/:id/messages', async (req, res) => {
  try {
    const { limit = '50', offset = '0' } = req.query;

    const messages = await mcpClient.querySQLite(
      `SELECT * FROM messages
       WHERE session_id = ?
       ORDER BY timestamp ASC
       LIMIT ? OFFSET ?`,
      [req.params.id, parseInt(limit), parseInt(offset)]
    );

    const countResult = await mcpClient.querySQLite(
      'SELECT COUNT(*) as count FROM messages WHERE session_id = ?',
      [req.params.id]
    );

    const total = countResult[0]?.count || 0;

    res.json({
      success: true,
      messages,
      total,
      has_more: parseInt(offset) + messages.length < total
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
