import config from "@incanta/config";
import NextAuth from "next-auth";
import { type Session } from "next-auth";
import { NextResponse } from "next/server";
import { cache } from "react";

import { authConfig, stubEnabled } from "./config";
import { db } from "~/server/db";

/**
 * When stub auth is enabled (dev environment), we bypass NextAuth entirely
 * and always return a session for the configured dev DM user. The DM user
 * is upserted into the database on first access so foreign-key references
 * work normally.
 */
async function createStubAuth(): Promise<{
  auth: () => Promise<Session>;
  handlers: { GET: () => Response; POST: () => Response };
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}> {
  const stubId = config.get<string>("auth.stub.dm.id");
  const stubName = config.get<string>("auth.stub.dm.name");
  const stubEmail = config.get<string>("auth.stub.dm.email");

  // Ensure the dev DM user exists in the database
  await db.user.upsert({
    where: { id: stubId },
    update: {},
    create: {
      id: stubId,
      name: stubName,
      email: stubEmail,
    },
  });

  const stubSession: Session = {
    user: {
      id: stubId,
      name: stubName,
      email: stubEmail,
    },
    expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };

  return {
    auth: async () => stubSession,
    handlers: {
      GET: () => NextResponse.redirect(new URL("/dashboard", "http://localhost")),
      POST: () => NextResponse.redirect(new URL("/", "http://localhost")),
    },
    signIn: async () => {},
    signOut: async () => {},
  };
}

function createRealAuth() {
  const { auth: uncachedAuth, handlers, signIn, signOut } = NextAuth(authConfig);
  const auth = cache(uncachedAuth);
  return { auth, handlers, signIn, signOut };
}

const { auth, handlers, signIn, signOut } = stubEnabled
  ? await createStubAuth()
  : createRealAuth();

export { auth, handlers, signIn, signOut };
