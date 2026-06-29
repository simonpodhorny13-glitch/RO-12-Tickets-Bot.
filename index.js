const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const express = require("express");

const VOYAGES_CHANNEL_ID = "1519404986079903854";

/* ---------------- KEEP ALIVE ---------------- */

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("RO-12 bot is live"));
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on port ${PORT}`)
);

/* ---------------- CLIENT ---------------- */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const TOKEN = process.env.TOKEN;

/* ---------------- DATA ---------------- */

function loadData() {
  try {
    if (!fs.existsSync("data.json")) {
      return {
        users: {},
        voyages: {},
        voyageIdCounter: 1
      };
    }
    return JSON.parse(fs.readFileSync("data.json", "utf8"));
  } catch {
    return {
      users: {},
      voyages: {},
      voyageIdCounter: 1
    };
  }
}

let data = loadData();
let voyages = data.voyages || {};
let voyageIdCounter = data.voyageIdCounter || 1;

/* safety sync */
data.voyages = voyages;
data.voyageIdCounter = voyageIdCounter;

/* ---------------- SAVE ---------------- */

function saveData() {
  data.users = data.users || {};
  data.voyages = voyages;
  data.voyageIdCounter = voyageIdCounter;

  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
}

/* ---------------- USER ---------------- */

function getUser(id) {
  if (!data.users[id]) {
    data.users[id] = {
      balance: 250,
      seat: null,
      cabin: null
    };
    saveData();
  }
  return data.users[id];
}

/* ---------------- UTILS ---------------- */

function isValidSeat(seat) {
  return /^([1-9]|1[0-9]|20)[A-F]$/.test(seat);
}

function getRouteData(code) {
  if (code === "1") return { name: "Short", multiplier: 1 };
  if (code === "2") return { name: "Medium", multiplier: 1.5 };
  if (code === "3") return { name: "Long", multiplier: 2 };
  return { name: "Unknown", multiplier: 1 };
}

function getBasePrice(multiplier = 1) {
  return 50 * multiplier;
}

/* ---------------- COMMAND LOADER ---------------- */

const commands = new Collection();

try {
  const commandPath = path.join(__dirname, "commands");
  const commandFiles = fs.readdirSync(commandPath);

  for (const file of commandFiles) {
    const cmd = require(path.join(commandPath, file));
    commands.set(cmd.name, cmd);
  }
} catch (e) {
  console.log("No commands folder or error loading commands", e);
}

/* ---------------- SLASH COMMANDS ---------------- */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, {
      getUser,
      data,
      voyages,
      saveData
    });
  } catch (err) {
    console.error(err);
    interaction.reply({ content: "❌ Command error", ephemeral: true });
  }
});

/* ---------------- MESSAGE COMMANDS ---------------- */

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content;
  const user = getUser(message.author.id);

  /* ---------------- BALANCE ---------------- */
  if (content === "!balance") {
    return message.reply(`💰 Your balance: $${user.balance}`);
  }

  /* ---------------- MAP ---------------- */
  if (content === "!map cabins") {
    const isTaken = (id) => {
      return Object.values(voyages).some(v => v.cabinMap?.[id]);
    };

    return message.channel.send(
      `🛏️ CABINS\n\n` +
      `ECONOMY\n1A ${isTaken("1A") ? "[X]" : "[ ]"} 1B ${isTaken("1B") ? "[X]" : "[ ]"} 2A ${isTaken("2A") ? "[X]" : "[ ]"} 2B ${isTaken("2B") ? "[X]" : "[ ]"}\n\n` +
      `FIRST\n1C ${isTaken("1C") ? "[X]" : "[ ]"} 1D ${isTaken("1D") ? "[X]" : "[ ]"} 2C ${isTaken("2C") ? "[X]" : "[ ]"} 2D ${isTaken("2D") ? "[X]" : "[ ]"}\n\n` +
      `DOUBLE\n3A ${isTaken("3A") ? "[X]" : "[ ]"} 3B ${isTaken("3B") ? "[X]" : "[ ]"} 3C ${isTaken("3C") ? "[X]" : "[ ]"} 3D ${isTaken("3D") ? "[X]" : "[ ]"}`
    );
  }

  /* ---------------- SET VOYAGE ---------------- */
  if (content.startsWith("!setvoyage")) {
    const channel = message.channel.name;
    if (channel !== "staff") return;

    const parts = content.split(" ");
    const from = parts[1];
    const to = parts[2];
    const routeCode = parts[3];

    const route = getRouteData(routeCode);

    const id = String(data.voyageIdCounter++);
    voyageIdCounter = data.voyageIdCounter;

    voyages[id] = {
      id,
      from,
      to,
      length: route.name,
      multiplier: route.multiplier,
      ship: "RO-12",
      crew: { captain: null, fo: null, gc: null },
      departure: parts.slice(4).join(" ") || "TBA",
      salesOpen: false,
      cancelled: false,
      gcDeadline: null,
      cabinMap: {},
      seatMap: {}
    };

    saveData();

    return message.channel.send(`🚢 VOYAGE CREATED\nID: ${id}\n${from} → ${to}`);
  }

  /* ---------------- CLAIM ---------------- */
  if (content.startsWith("!claim")) {
    const parts = content.split(" ");
    const role = parts[1];
    const id = parts[2];

    const v = voyages[id];
    if (!v) return message.reply("❌ Voyage not found.");

    const roles = message.member?.roles.cache;

    if (!["captain", "fo", "gc"].includes(role))
      return message.reply("❌ Invalid role.");

    if (!v.crew) v.crew = { captain: null, fo: null, gc: null };

    if (v.crew[role])
      return message.reply("❌ Already claimed.");

    const hasRole = (name) => roles.some(r => r.name === name);

    if (role === "captain" && !hasRole("Captain"))
      return message.reply("❌ Not Captain.");

    if (role === "fo" && !hasRole("First Officer"))
      return message.reply("❌ Not FO.");

    if (role === "gc" && !hasRole("Ground Crew"))
      return message.reply("❌ Not GC.");

    v.crew[role] = message.author.id;

    saveData();

    const crew = v.crew;

    if (crew.captain && crew.fo) {
      if (!crew.gc && !v.gcDeadline) {
        v.gcDeadline = Date.now() + 24 * 60 * 60 * 1000;
        message.channel.send(`⏳ Ground Crew unclaimed. Sales open in 24h.`);
      }

      if (crew.gc && v.gcDeadline) delete v.gcDeadline;

      if (crew.gc && !v.salesOpen) {
        v.salesOpen = true;
        message.channel.send(`🚢 SALES OPEN (Voyage ${id})`);
      }
    }

    saveData();
    return message.reply(`✅ ${role} claimed.`);
  }

  /* ---------------- BOOKING ---------------- */
  if (content.startsWith("!bookcabin") || content.startsWith("!seat")) {
    const isCabin = content.startsWith("!bookcabin");
    const target = content.split(" ")[1];

    const active = Object.values(voyages).filter(v => v.salesOpen && !v.cancelled);
    const v = active[active.length - 1];

    if (!v) return message.reply("❌ No active voyage.");
    if (!target) return message.reply("❌ Missing input.");

    const price = getBasePrice(v.multiplier);

    if (isCabin) {
      if (v.cabinMap[target]) return message.reply("❌ Taken.");

      user.balance -= price;
      v.cabinMap[target] = message.author.id;
      user.cabin = target;
    } else {
      if (!isValidSeat(target) || v.seatMap[target])
        return message.reply("❌ Invalid/taken.");

      user.balance -= price;
      v.seatMap[target] = message.author.id;
      user.seat = target;
    }

    saveData();
    return message.reply(`✅ Booked ${target}`);
  }

  /* ---------------- CANCEL ---------------- */
  if (content === "!cancel") {
    let refund = 0;

    for (const v of Object.values(voyages)) {
      if (v.seatMap?.[user.seat]) delete v.seatMap[user.seat];
      if (v.cabinMap?.[user.cabin]) delete v.cabinMap[user.cabin];
    }

    if (user.seat) {
      refund += getBasePrice(1) * 0.9;
      user.seat = null;
    }

    if (user.cabin) {
      refund += getBasePrice(1) * 0.9;
      user.cabin = null;
    }

    user.balance += Math.floor(refund);
    saveData();

    return message.reply(`💸 Refund: $${Math.floor(refund)}`);
  }
});

/* ---------------- AUTO ENGINE ---------------- */

setInterval(async () => {
  let changed = false;

  for (const id in voyages) {
    const v = voyages[id];
    if (!v || v.cancelled || v.salesOpen) continue;

    const crew = v.crew;
    if (!crew?.captain || !crew?.fo) continue;

    if (!crew.gc && !v.gcDeadline) {
      v.gcDeadline = Date.now() + 24 * 60 * 60 * 1000;
      changed = true;
    }

    if (crew.gc && v.gcDeadline) delete v.gcDeadline;

    if (v.gcDeadline && Date.now() >= v.gcDeadline) {
      v.salesOpen = true;
      delete v.gcDeadline;

      try {
        const channel = await client.channels.fetch(VOYAGES_CHANNEL_ID);
        channel.send(`🚢 SALES OPENED\nVoyage ${id}\n${v.from} → ${v.to}`);
      } catch (err) {
        console.error(err);
      }

      changed = true;
    }
  }

  if (changed) saveData();
}, 60000);

/* ---------------- LOGIN ---------------- */if (!process.env.TOKEN) {
  console.log("❌ TOKEN missing");
} else {
  console.log("✅️ TOKEN EXISTS:", true);

  client.login(process.env.TOKEN)
    .then(() => console.log("✅️ Logged in as", client.user.tag))
    .catch(err => console.error("❌ Login error:", err));
}
