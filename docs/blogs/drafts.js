// drafts.js
import fs from "node:fs/promises";

const HASHNODE_ENDPOINT = "https://gql.hashnode.com";
const HASHNODE_TOKEN = process.env.HASHNODE_TOKEN;             // Settings → Developer → Personal Access Token
const PUBLICATION_ID = process.env.HASHNODE_PUBLICATION_ID;     // Your publication/blog ID

if (!HASHNODE_TOKEN || !PUBLICATION_ID) {
  console.error("Set HASHNODE_TOKEN and HASHNODE_PUBLICATION_ID env vars.");
  process.exit(1);
}

const mutation = `
mutation CreateDraft($input: CreateDraftInput!) {
  createDraft(input: $input) { draft { id title slug } }
}`;

async function main() {
  const raw = await fs.readFile("./posts.json", "utf8");
  const posts = JSON.parse(raw);

  for (const p of posts) {
    const variables = {
      input: {
        publicationId: PUBLICATION_ID,
        title: p.title,
        subtitle: p.subtitle || null,
        tags: p.tags || [],
        contentMarkdown: p.contentMarkdown
      }
    };

    const res = await fetch(HASHNODE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${HASHNODE_TOKEN}`
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    const json = await res.json();
    if (json.errors) {
      console.error("❌ Failed:", p.title, JSON.stringify(json.errors));
    } else {
      const d = json.data.createDraft.draft;
      console.log("✅ Created draft:", d.title, d.slug);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

