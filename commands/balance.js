const fs = require("fs");

module.exports = {
  name: "balance",
  description: "Check your balance",

  async execute(interaction) {
    const data = JSON.parse(fs.readFileSync("./data.json", "utf8"));
    const userId = interaction.user.id;

    const user = data.users?.[userId];

    const balance = user?.balance || 0;

    return interaction.reply({
      content: `💰 Balance: $${balance}`,
      ephemeral: true
    });
  }
};