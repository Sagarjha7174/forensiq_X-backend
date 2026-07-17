const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, '../../../data/eventStats.json');

// Ensure data directory and file exist
const initStatsFile = () => {
  const dir = path.dirname(STATS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(STATS_FILE)) {
    fs.writeFileSync(STATS_FILE, JSON.stringify({
      participants: "1.2k+",
      communities: "5"
    }, null, 2));
  }
};

exports.getStats = async (req, res) => {
  try {
    initStatsFile();
    const data = fs.readFileSync(STATS_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error("Error reading event stats:", error);
    res.status(500).json({ error: "Failed to fetch event stats" });
  }
};

exports.updateStats = async (req, res) => {
  try {
    initStatsFile();
    const { participants, communities } = req.body;
    
    // Read current
    const currentData = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    
    // Update
    if (participants !== undefined) currentData.participants = participants;
    if (communities !== undefined) currentData.communities = communities;
    
    fs.writeFileSync(STATS_FILE, JSON.stringify(currentData, null, 2));
    
    res.json(currentData);
  } catch (error) {
    console.error("Error updating event stats:", error);
    res.status(500).json({ error: "Failed to update event stats" });
  }
};
