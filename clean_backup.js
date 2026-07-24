async function main() {
  const fs = await import("node:fs");
  const content = fs.readFileSync("schema_backup.prisma", "utf8");

  // The file might contain double quotes at start and end and escaped characters.
  // Parse it as a JSON string to get the original unescaped text.
  try {
    const cleanContent = JSON.parse(content.trim());
    fs.writeFileSync("schema_backup_clean.prisma", cleanContent, "utf8");
    console.log("Successfully unescaped schema_backup.prisma into schema_backup_clean.prisma");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error parsing schema_backup.prisma:", message);

    let manual = content.trim();
    if (manual.startsWith('"') && manual.endsWith('"')) {
      manual = manual.slice(1, -1);
    }
    manual = manual.replace(/\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    fs.writeFileSync("schema_backup_clean.prisma", manual, "utf8");
    console.log("Manually unescaped schema_backup.prisma into schema_backup_clean.prisma");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
