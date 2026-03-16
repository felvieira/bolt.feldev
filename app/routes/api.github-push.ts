/**
 * /api/github-push — Push project files to a GitHub repo.
 *
 * Creates the repo if needed, then pushes all files in a single commit
 * using the GitHub Trees/Commits API (works without git binary).
 *
 * Body: {
 *   token: string,
 *   owner: string,
 *   repo: string,
 *   files: Record<string, string>,  // path → content
 *   message?: string,
 *   branch?: string,
 *   isPrivate?: boolean,
 *   createRepo?: boolean,
 * }
 */
import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

const GITHUB_API = 'https://api.github.com';

async function gh(token: string, path: string, opts: RequestInit = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  return res;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const {
      token,
      owner,
      repo,
      files,
      message = 'Update from bolt.feldev',
      branch = 'main',
      isPrivate = true,
      createRepo = false,
    } = (await request.json()) as {
      token: string;
      owner: string;
      repo: string;
      files: Record<string, string>;
      message?: string;
      branch?: string;
      isPrivate?: boolean;
      createRepo?: boolean;
    };

    if (!token || !owner || !repo || !files) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Create repo if needed
    if (createRepo) {
      const checkRes = await gh(token, `/repos/${owner}/${repo}`);

      if (checkRes.status === 404) {
        const createRes = await gh(token, '/user/repos', {
          method: 'POST',
          body: JSON.stringify({
            name: repo,
            private: isPrivate,
            auto_init: true,
            description: 'Created by bolt.feldev',
          }),
        });

        if (!createRes.ok) {
          const err = await createRes.json();
          return json({ error: `Failed to create repo: ${err.message}` }, { status: 400 });
        }

        // Wait for repo initialization
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    // 2. Get latest commit SHA on the branch
    let baseSha: string;
    let baseTreeSha: string;

    const refRes = await gh(token, `/repos/${owner}/${repo}/git/ref/heads/${branch}`);

    if (refRes.ok) {
      const refData = (await refRes.json()) as any;
      baseSha = refData.object.sha;

      const commitRes = await gh(token, `/repos/${owner}/${repo}/git/commits/${baseSha}`);
      const commitData = (await commitRes.json()) as any;
      baseTreeSha = commitData.tree.sha;
    } else {
      // Branch doesn't exist — first commit
      baseSha = '';
      baseTreeSha = '';
    }

    // 3. Create blobs for each file
    const treeItems = [];

    for (const [filePath, content] of Object.entries(files)) {
      const blobRes = await gh(token, `/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({
          content,
          encoding: 'utf-8',
        }),
      });

      if (!blobRes.ok) {
        console.error(`Failed to create blob for ${filePath}`);
        continue;
      }

      const blobData = (await blobRes.json()) as any;
      treeItems.push({
        path: filePath,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blobData.sha,
      });
    }

    // 4. Create tree
    const treeBody: any = { tree: treeItems };

    if (baseTreeSha) {
      treeBody.base_tree = baseTreeSha;
    }

    const treeRes = await gh(token, `/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify(treeBody),
    });

    if (!treeRes.ok) {
      const err = await treeRes.json();
      return json({ error: `Failed to create tree: ${JSON.stringify(err)}` }, { status: 400 });
    }

    const treeData = (await treeRes.json()) as any;

    // 5. Create commit
    const commitBody: any = {
      message,
      tree: treeData.sha,
    };

    if (baseSha) {
      commitBody.parents = [baseSha];
    }

    const commitRes = await gh(token, `/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify(commitBody),
    });

    if (!commitRes.ok) {
      const err = await commitRes.json();
      return json({ error: `Failed to create commit: ${JSON.stringify(err)}` }, { status: 400 });
    }

    const commitData = (await commitRes.json()) as any;

    // 6. Update branch ref
    const updateRefRes = await gh(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commitData.sha, force: true }),
    });

    if (!updateRefRes.ok) {
      // Maybe branch doesn't exist yet — create it
      const createRefRes = await gh(token, `/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commitData.sha }),
      });

      if (!createRefRes.ok) {
        const err = await createRefRes.json();
        return json({ error: `Failed to update ref: ${JSON.stringify(err)}` }, { status: 400 });
      }
    }

    return json({
      success: true,
      commitSha: commitData.sha,
      url: `https://github.com/${owner}/${repo}`,
      filesCount: treeItems.length,
    });
  } catch (e: any) {
    return json({ error: e.message }, { status: 500 });
  }
}
