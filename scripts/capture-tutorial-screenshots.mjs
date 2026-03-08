import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://amhnbyimvgykklzrenky.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_2A5LzuE-E3YLqqlrImpMKw_rkKGtmZ8';
const BASE_URL = process.env.TUTORIAL_BASE_URL || 'http://127.0.0.1:4205';
const BASE_PORT = Number(new URL(BASE_URL).port || 4205);
const SCREEN_DIR = 'public/tutorials';

const ROUTES = [
  { path: '/onboarding?force=1', file: 'onboarding-flow.jpg' },
  { path: '/app', file: 'today-dashboard.jpg', readyText: 'Today' },
  { path: '/recipes', file: 'recipes-library.jpg', readyText: 'Recipes' },
  { path: '/meals', file: 'meals-weekly.jpg', readyText: 'Weekly Meals' },
  { path: '/grocery', file: 'grocery-rollup.jpg', readyText: 'Grocery' },
  { path: '/calendar', file: 'calendar-planner.jpg', readyText: 'Calendar Planner' },
  { path: '/calendar/connect-apple', file: 'calendar-apple-connect.jpg', readyText: 'Connect Apple Calendar' },
  { path: '/chores', file: 'chores-board.jpg', readyText: 'Chores' },
  { path: '/tasks', file: 'tasks-board.jpg', readyText: 'Tasks' },
  { path: '/workouts', file: 'workouts-home.jpg', readyText: 'Workouts' },
  { path: '/workouts/templates', file: 'workouts-templates.jpg', readyText: 'Templates' },
  { path: '/family', file: 'family-members.jpg', readyText: 'Family' },
  { path: '/settings', file: 'settings-page.jpg', readyText: 'Settings' },
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, attempts = 90) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // ignore during boot
    }
    await wait(1000);
  }
  throw new Error(`Server did not start in time at ${url}`);
}

async function createCaptureUser() {
  const email = `capture-${Date.now()}@example.com`;
  const password = 'Capture123456!';
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${BASE_URL}/reset-password`,
      data: { full_name: 'Tutorial Capture' },
    },
  });

  if (error || !data.user || !data.session) {
    throw new Error(error?.message || 'Failed to create capture user session.');
  }

  const authed = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: sessionError } = await authed.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (sessionError) throw new Error(sessionError.message);

  const { error: profileError } = await authed
    .from('profiles')
    .update({
      full_name: 'Tutorial Capture',
      household_name: 'Capture Household',
      family_size: 4,
      goals: 'Build calmer weekly planning with meals, groceries, and routines.',
      dietary_preferences: ['Healthy and easy', 'Family-friendly'],
      timezone: 'America/Chicago',
    })
    .eq('id', data.user.id);

  if (profileError) {
    throw new Error(`Could not finalize capture profile: ${profileError.message}`);
  }

  return { email, password, userId: data.user.id };
}

async function signIn(page, email, password) {
  console.log('Opening sign-in page...');
  await page.goto(`${BASE_URL}/signin`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type=\"email\"]', { timeout: 30000 });
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  console.log('Submitting sign-in form...');
  await page.getByRole('button', { name: 'Sign In' }).click();

  for (let i = 0; i < 30; i += 1) {
    await wait(500);
    const url = page.url();
    if (!url.includes('/signin')) return;
  }
  throw new Error('Sign in did not complete in time.');
}

async function dismissFamilySetupModal(page) {
  const maybeLater = page.getByRole('button', { name: /I'll do this later/i });
  try {
    if (await maybeLater.isVisible({ timeout: 1200 })) {
      await maybeLater.click();
      await page.waitForTimeout(300);
    }
  } catch {
    // modal not shown
  }
}

async function capture() {
  const user = await createCaptureUser();
  console.log(`Created capture user: ${user.email}`);
  await rm(SCREEN_DIR, { recursive: true, force: true });
  await mkdir(SCREEN_DIR, { recursive: true });

  const dev = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(BASE_PORT)], {
    stdio: 'pipe',
    shell: true,
  });

  let bootLogs = '';
  dev.stdout.on('data', (chunk) => {
    bootLogs += chunk.toString();
  });
  dev.stderr.on('data', (chunk) => {
    bootLogs += chunk.toString();
  });

  try {
    console.log('Waiting for local dev server...');
    await waitForHttp(`${BASE_URL}/signin`);
    console.log('Dev server is ready.');

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

    await signIn(page, user.email, user.password);
    await page.evaluate((userId) => {
      localStorage.setItem(`homehub.family-setup-prompt.v1:${userId}`, '1');
    }, user.userId);
    await dismissFamilySetupModal(page);
    console.log(`Signed in, current URL: ${page.url()}`);

    for (const route of ROUTES) {
      console.log(`Capturing ${route.path} -> ${route.file}`);
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('body', { timeout: 20000 });
      if (route.readyText) {
        await page.getByText(route.readyText, { exact: false }).first().waitFor({ timeout: 30000 });
      } else if (route.path.startsWith('/onboarding')) {
        await page.waitForTimeout(2500);
      }
      await dismissFamilySetupModal(page);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${SCREEN_DIR}/${route.file}`, fullPage: true, type: 'jpeg', quality: 85 });
      console.log(`Captured ${route.file}`);
    }

    await browser.close();
    console.log(`Saved screenshots to ${SCREEN_DIR}`);
  } finally {
    dev.kill('SIGTERM');
    if (bootLogs) {
      const tail = bootLogs.split('\n').slice(-20).join('\n').trim();
      if (tail) console.log(`\nDev server tail:\n${tail}`);
    }
  }
}

capture().catch((error) => {
  console.error(error);
  process.exit(1);
});
