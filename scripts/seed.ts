/**
 * Seed script for SPITr test data
 * Run with: npx tsx scripts/seed.ts
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load .env.local
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.log('Add SUPABASE_SERVICE_ROLE_KEY to your .env.local file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const testUsers = [
  { email: 'alice@test.com', handle: 'alice', name: 'Alice Chen', bio: 'Full-stack dev | Open source contributor | Coffee addict' },
  { email: 'bob@test.com', handle: 'bob', name: 'Bob Smith', bio: 'DevOps engineer | Linux enthusiast | Homelab nerd' },
  { email: 'charlie@test.com', handle: 'charlie', name: 'Charlie Davis', bio: 'Security researcher | CTF player | Bug bounty hunter' },
  { email: 'diana@test.com', handle: 'diana', name: 'Diana Kim', bio: 'UI/UX designer | Pixel perfectionist | Synthwave fan' },
  { email: 'eve@test.com', handle: 'eve', name: 'Eve Martinez', bio: 'Data scientist | ML enthusiast | Python lover' },
]

const spitContents = [
  "Just deployed to production on a Friday. Living dangerously. 🚀",
  "Who else thinks semicolons are overrated?",
  "The best code is the code you don't have to write.",
  "Debugging is like being a detective in a crime movie where you're also the murderer.",
  "rm -rf node_modules && npm install - the universal fix",
  "Remember: a working program is just a bug waiting to be discovered.",
  "My code doesn't have bugs, it has 'unexpected features'.",
  "Just spent 4 hours debugging only to find a missing comma.",
  "Coffee: because production incidents don't wait for sleep.",
  "The cloud is just someone else's computer.",
  "Documentation? You mean the code comments I'll write later?",
  "git push --force is how I assert dominance.",
  "If it works, don't touch it. If you touch it, may God help you.",
  "Stack Overflow: the real MVP of software development.",
  "Writing tests is just writing more code that can have bugs.",
  "sudo make me a sandwich",
  "There are only 10 types of people in this world...",
  "Tabs vs spaces? I use both to assert chaos.",
  "Dark mode is the only mode.",
  "First rule of programming: if it works, don't ask why.",
  "I don't always test my code, but when I do, I do it in production.",
  "Error 404: Productivity not found.",
  "The S in IoT stands for Security.",
  "Encryption is just fancy math that makes people feel safe.",
  "AI will replace programmers? Let me ask ChatGPT to fix this bug first.",
  "Legacy code is just code that works and you're afraid to touch.",
  "The best password is the one you can never remember.",
  "Microservices: because one monolith wasn't enough to debug.",
  "REST in peace, SOAP.",
  "Kubernetes is just Docker with extra steps."
]

async function seed() {
  console.log('🌱 Starting seed...\n')

  const userIds: string[] = []

  // Create test users
  for (const testUser of testUsers) {
    console.log(`Creating user: ${testUser.handle}...`)

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testUser.email,
      password: 'password123',
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log(`  User ${testUser.handle} already exists, fetching...`)
        const { data: existingUsers } = await supabase
          .from('users')
          .select('id')
          .eq('handle', testUser.handle)
          .single()

        if (existingUsers) {
          userIds.push(existingUsers.id)
        }
        continue
      }
      console.error(`  Error creating auth user: ${authError.message}`)
      continue
    }

    const userId = authData.user.id
    userIds.push(userId)

    // Create user profile
    const { error: profileError } = await supabase.from('users').upsert({
      id: userId,
      handle: testUser.handle,
      name: testUser.name,
      bio: testUser.bio,
    })

    if (profileError) {
      console.error(`  Error creating profile: ${profileError.message}`)
    }

    // Create user credits
    const { error: creditsError } = await supabase.from('user_credits').upsert({
      user_id: userId,
      balance: 1000,
    })

    if (creditsError) {
      console.error(`  Error creating credits: ${creditsError.message}`)
    }

    console.log(`  ✓ Created ${testUser.handle}`)
  }

  console.log(`\nCreated ${userIds.length} users`)

  // Fetch all user IDs if some already existed
  const { data: allUsers } = await supabase.from('users').select('id, handle')
  const allUserIds = allUsers?.map(u => u.id) || userIds

  if (allUserIds.length === 0) {
    console.log('No users found, skipping spits and follows')
    return
  }

  // Create spits
  console.log('\nCreating spits...')
  const spitIds: string[] = []

  for (let i = 0; i < spitContents.length; i++) {
    const userId = allUserIds[i % allUserIds.length]
    const content = spitContents[i]

    // Randomize timestamp within the last 7 days
    const daysAgo = Math.random() * 7
    const timestamp = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('spits')
      .insert({
        user_id: userId,
        content,
        created_at: timestamp,
      })
      .select('id')
      .single()

    if (error) {
      console.error(`  Error creating spit: ${error.message}`)
    } else if (data) {
      spitIds.push(data.id)
    }
  }

  console.log(`  ✓ Created ${spitIds.length} spits`)

  // Create some likes
  console.log('\nCreating likes...')
  let likeCount = 0

  for (const spitId of spitIds) {
    // Random number of likes (0-5) per spit
    const numLikes = Math.floor(Math.random() * 6)
    const likers = [...allUserIds].sort(() => Math.random() - 0.5).slice(0, numLikes)

    for (const userId of likers) {
      const { error } = await supabase.from('likes').insert({
        user_id: userId,
        spit_id: spitId,
      })

      if (!error) likeCount++
    }
  }

  console.log(`  ✓ Created ${likeCount} likes`)

  // Create some respits
  console.log('\nCreating respits...')
  let respitCount = 0

  for (const spitId of spitIds.slice(0, 10)) {
    const numRespits = Math.floor(Math.random() * 3)
    const respiters = [...allUserIds].sort(() => Math.random() - 0.5).slice(0, numRespits)

    for (const userId of respiters) {
      const { error } = await supabase.from('respits').insert({
        user_id: userId,
        spit_id: spitId,
      })

      if (!error) respitCount++
    }
  }

  console.log(`  ✓ Created ${respitCount} respits`)

  // Create some follows
  console.log('\nCreating follows...')
  let followCount = 0

  for (const followerId of allUserIds) {
    // Each user follows 2-4 random other users
    const numFollows = 2 + Math.floor(Math.random() * 3)
    const toFollow = allUserIds
      .filter(id => id !== followerId)
      .sort(() => Math.random() - 0.5)
      .slice(0, numFollows)

    for (const followingId of toFollow) {
      const { error } = await supabase.from('follows').insert({
        follower_id: followerId,
        following_id: followingId,
      })

      if (!error) followCount++
    }
  }

  console.log(`  ✓ Created ${followCount} follows`)

  // Create some replies
  console.log('\nCreating replies...')
  let replyCount = 0

  const replies = [
    "This is so true!",
    "Couldn't agree more",
    "Been there, done that",
    "Haha exactly",
    "Facts",
    "I feel attacked",
    "This is the way",
    "Big if true",
  ]

  for (const spitId of spitIds.slice(0, 8)) {
    const replier = allUserIds[Math.floor(Math.random() * allUserIds.length)]
    const replyContent = replies[Math.floor(Math.random() * replies.length)]

    const { error } = await supabase.from('spits').insert({
      user_id: replier,
      content: replyContent,
      reply_to_id: spitId,
    })

    if (!error) replyCount++
  }

  console.log(`  ✓ Created ${replyCount} replies`)

  console.log('\n✅ Seed complete!')
  console.log('\nTest accounts:')
  for (const user of testUsers) {
    console.log(`  ${user.email} / password123`)
  }
}

seed().catch(console.error)
