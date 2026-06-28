const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const express = require("express");

/* ---------------- KEEP ALIVE ---------------- */

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("RO-12 bot is alive"));
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

let data = loadData();
let activeVoyage = null;
let voyageId = 1;

/* ---------------- FILE ---------------- */

function loadData() {
  try {
    if (!fs.existsSync("data.json")) {
      return { users: {}, seatMap: {}, cabinMap: {} };
    }
    return JSON.parse(fs.readFileSync("data.json", "utf8"));
  } catch {
    return { users: {}, seatMap: {}, cabinMap: {} };
  }
}

function saveData() {
  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
}

/* ---------------- USER ---------------- */

function getUser(id) {
  if (!data.users[id]) {
    data.users[id] = { balance: 250, seat: null, cabin: null };
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

function getBasePrice() {
  return 50 * (activeVoyage?.multiplier || 1);
}

/* ---------------- SLASH COMMANDS ---------------- */

const commands = new Collection();

try {
  const commandFiles = fs.readdirSync("./commands");
  for (const file of commandFiles) {
    const cmd = require(`./commands/${file}`);
    commands.set(cmd.data.name, cmd);
  }
} catch (e) {
  console.log("No commands folder or error loading commands");
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, {
      getUser,
      data,
      activeVoyage,
      voyageId,
      saveData,
      isValidSeat,
      getRouteData,
      getBasePrice,
    });
  } catch (err) {
    console.error(err);
    interaction.reply({
      content: "❌ Command error",
      ephemeral: true,
    });
  }
});

/* ---------------- MESSAGE COMMANDS (NOW INSIDE INDEX) ---------------- */

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content;
  const channel = message.channel.name;
  const user = getUser(message.author.id);

  const hasPermission = message.member?.roles.cache.some((r) =>
    ["Owner", "Admin", "Captain"].includes(r.name)
  );

  /* ---------------- BALANCE ---------------- */

  if (content === "!balance") {
    return message.reply(`💰 Your balance: $${user.balance}`);
  }

  /* ---------------- CABIN MAP ---------------- */

  if (content === "!map cabins") {
    const isTaken = (id) => (data.cabinMap[id] ? "[X]" : "[ ]");

    return message.channel.send(
      `🛏️ **CABINS**\n\n` +
        `**ECONOMY**\n1A ${isTaken("1A")} 1B ${isTaken("1B")} 2A ${isTaken("2A")} 2B ${isTaken("2B")}\n\n` +
        `**FIRST**\n1C ${isTaken("1C")} 1D ${isTaken("1D")} 2C ${isTaken("2C")} 2D ${isTaken("2D")}\n\n` +
        `**DOUBLE**\n3A ${isTaken("3A")} 3B ${isTaken("3B")} 3C ${isTaken("3C")} 3D ${isTaken("3D")}`
    );
  }

  /* ---------------- SET VOYAGE ---------------- */

  if (content.startsWith("!setvoyage")) {
    if (channel !== "staff") return;

    const parts = content.split(" ");
    const from = parts[1];
    const to = parts[2];
    const routeCode = parts[3];

    const route = getRouteData(routeCode);

    activeVoyage = {
      id: voyageId++,
      from,
      to,
      length: route.name,
      multiplier: route.multiplier,
      ship: "RO-12",
      captain: null,
      fo: null,
      gc: null,
      departure: parts.slice(4).join(" ") || "TBA",
      salesOpen: false,
    };

    return message.channel.send(
      `🚢 VOYAGE CREATED: ${from} → ${to} (${route.name})`
    );
  }

  /* ---------------- CLAIM ---------------- */

  if (content.startsWith("!claim")) {
    if (!activeVoyage) return message.reply("❌ No active voyage.");

    const role = content.split(" ")[1];
    const roles = message.member?.roles.cache;

    if (role === "captain") {
      if (activeVoyage.captain)
        return message.reply("❌ Already assigned.");
      if (!roles.some((r) => r.name === "Captain"))
        return message.reply("❌ Not Captain.");
      activeVoyage.captain = message.author.id;
    } else if (role === "fo") {
      if (activeVoyage.fo)
        return message.reply("❌ Already assigned.");
      if (!roles.some((r) => r.name === "First Officer"))
        return message.reply("❌ Not FO.");
      activeVoyage.fo = message.author.id;
    } else if (role === "gc") {
      if (activeVoyage.gc)
        return message.reply("❌ Already assigned.");
      if (!roles.some((r) => r.name === "Ground Crew"))
        return message.reply("❌ Not GC.");
      activeVoyage.gc = message.author.id;
    } else {
      return message.reply("❌ Invalid role.");
    }

    return message.reply(`✅ ${role} claimed.`);
  }

  /* ---------------- BOOKING ---------------- */

  if (content.startsWith("!bookcabin") || content.startsWith("!seat")) {
    if (!activeVoyage || !activeVoyage.salesOpen)
      return message.reply("❌ Booking closed.");

    const isCabin = content.startsWith("!bookcabin");
    const target = content.split(" ")[1];

    if (!target) return message.reply("❌ Missing input.");

    const price = getBasePrice();

    if (isCabin) {
      if (data.cabinMap[target] || user.cabin)
        return message.reply("❌ Taken.");

      user.balance -= price;
      data.cabinMap[target] = message.author.id;
      user.cabin = target;
    } else {
      if (!isValidSeat(target) || data.seatMap[target] || user.seat)
        return message.reply("❌ Invalid or taken.");

      user.balance -= price;
      data.seatMap[target] = message.author.id;
      user.seat = target;
    }

    saveData();
    return message.reply(`✅ Booked ${target}`);
  }

  /* ---------------- CANCEL ---------------- */

  if (content === "!cancel") {
    if (!activeVoyage) return;
    let refund = 0;

    if (user.seat) {
      refund += getBasePrice() * 0.9;
      delete data.seatMap[user.seat];
      user.seat = null;
    }

    if (user.cabin) {
      refund += getBasePrice() * 0.9;
      delete data.cabinMap[user.cabin];
      user.cabin = null;
    }

    user.balance += Math.floor(refund);
    saveData();

    return message.reply(`💸 Refund: $${Math.floor(refund)}`);
  }
});

/* ---------------- LOGIN ---------------- */

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(TOKEN);

const fs = require("fs");

// =========================
// 🚢 AUTO VOYAGE ENGINE
// =========================
setInterval(() => {
  let data;

  try {
    data = JSON.parse(fs.readFileSync("./data.json", "utf8"));
  } catch (err) {
    console.log("❌ Failed to read data.json");
    return;
  }

  let changed = false;

  for (const id in data.voyages) {
    const v = data.voyages[id];

    if (!v || v.cancelled || v.salesOpen) continue;

    const crew = v.crew || {};
    const hasCaptainFO = crew.captain && crew.fo;

    if (!hasCaptainFO) continue;

    // =========================
    // 🚢 GC TIMEOUT CHECK
    // =========================
    if (v.gcDeadline && Date.now() >= v.gcDeadline) {

      v.salesOpen = true;
      delete v.gcDeadline;

      changed = true;

      console.log(`🚢 AUTO SALES OPENED: ${id}`);
    }
  }

  if (changed) {
    fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));
  }

}, 60 * 1000); // every 1 minute
