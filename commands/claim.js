const fs = require("fs");

module.exports = {
  name: "claim",

  execute(message, args) {
    const role = args[0];
    const voyageId = args[1];

    if (!role || !voyageId) {
      return message.reply("❌ Usage: !claim <captain|fo|gc> <voyageId>");
    }

    const data = JSON.parse(fs.readFileSync("./data.json", "utf8"));
    const voyage = data.voyages[voyageId];

    if (!voyage) {
      return message.reply("❌ Voyage not found.");
    }

    if (!voyage.crew) {
      voyage.crew = { captain: null, fo: null, gc: null };
    }

    const userId = message.author.id;

    if (!["captain", "fo", "gc"].includes(role)) {
      return message.reply("❌ Role must be captain, fo, or gc.");
    }

    if (voyage.crew[role]) {
      return message.reply(`❌ ${role.toUpperCase()} already claimed.`);
    }

    // assign role
    voyage.crew[role] = userId;

    const crew = voyage.crew;

    // =========================
    // 🚢 CAPTAIN + FO LOGIC
    // =========================
    if (crew.captain && crew.fo) {

      // START GC TIMER ONLY ONCE
      if (!crew.gc && !voyage.gcDeadline) {
        voyage.gcDeadline = Date.now() + 24 * 60 * 60 * 1000;

        message.channel.send(
`⏳ Ground Crew role unclaimed.
Sales will begin automatically within 24 hours if not claimed.`
        );
      }

      // If GC exists, cancel timer
      if (crew.gc && voyage.gcDeadline) {
        delete voyage.gcDeadline;
      }

      // OPEN SALES IF GC ALREADY PRESENT
      if (crew.gc && !voyage.salesOpen) {
        voyage.salesOpen = true;

        message.channel.send(
`🚢 SALES NOW OPEN

Voyage ID
${voyageId}

From
${voyage.from}

To
${voyage.to}

Ship
${voyage.ship}

Departing
${voyage.date}, ${voyage.time}`
        );
      }
    }

    fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));

    message.reply(`✅ ${role.toUpperCase()} claimed for voyage ${voyageId}.`);
  }
};
