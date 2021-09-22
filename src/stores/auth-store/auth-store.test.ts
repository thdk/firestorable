import { waitFor } from "@testing-library/dom";
import { AuthStore, AuthStoreUser } from "./auth-store";

import type firebase from "firebase/compat";
import { FetchMode } from "../../collection";
import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";


const projectId = "auth-store-test";

class FakeAuth {
    public signOut() {
        this.authenticate(undefined);
    }
    private callback?(user: Partial<firebase.User> | undefined): void;
    public onAuthStateChanged(callback: (user: Partial<firebase.User> | undefined) => void) {
        this.callback = callback;
        return jest.fn();
    }

    public authenticate(user: Partial<firebase.User> | undefined) {
        this.callback && this.callback(user);
    }
}

const onSignOut = jest.fn();
const createAuthStore = (auth: any, firestore: firebase.firestore.Firestore) => {
    return new AuthStore(
        {
            firestore,
            auth: auth as unknown as firebase.auth.Auth,
        },
        {
            collection: "users",
            collectionOptions: {
                fetchMode: FetchMode.once,
            }
        }
    );
}

describe("AuthStore", () => {
    let testEnv: RulesTestEnvironment;
    let firestore: firebase.firestore.Firestore;
    let collectionRef: any;

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId,
            firestore: {
                host: "localhost",
                port: 8080,
            }
        });
        firestore = testEnv.unauthenticatedContext().firestore();
        collectionRef = firestore.collection("users");
    });

    afterEach(() => {
        jest.clearAllMocks();
        return testEnv.clearFirestore();
    });

    afterAll(() => testEnv.cleanup());

    describe("when user authenticates for the first time", () => {
        it("should add a new user on first login", async () => {
            const fakeAuth = new FakeAuth();
            const authStore = createAuthStore(fakeAuth, firestore);

            await waitFor(() => expect(() => authStore.isAuthInitialised).toBeTruthy());

            fakeAuth.authenticate({
                uid: "id-1",
                email: "user-1@team-timesheets.com",
                displayName: "User 1",
            });

            await waitFor(() => expect(() => authStore.activeDocument).toBeDefined());

            await waitFor(
                async () => {
                    const doc = await collectionRef.doc("id-1").get();
                    expect(doc.data()).toEqual(
                        expect.objectContaining({
                            uid: "id-1",
                            name: "User 1",
                            email: "user-1@team-timesheets.com",
                        }),
                    );
                }, {
                timeout: 8888,
            }
            );

            authStore.dispose();
        });

        it("should add a new user on first login: only uid", async () => {
            const fakeAuth = new FakeAuth();
            const authStore = createAuthStore(fakeAuth, firestore);

            fakeAuth.authenticate({
                uid: "id-1",
            });

            await waitFor(async () => {
                const doc = await collectionRef.doc("id-1").get();
                expect(doc.data()).toEqual(
                    expect.objectContaining({
                        uid: "id-1",
                    })
                );
            });

            authStore.dispose();
        });
    });

    describe("when existing user authenticated", () => {
        beforeEach(async () => {
            await Promise.all([
                collectionRef.doc("id-1").set({
                    uid: "id-1",
                    name: "User 1",
                    email: "user-1@team-timesheets.com",
                    bar: "foo",
                }),

                collectionRef.doc("id-2").set({
                    uid: "id-2",
                    name: "User 2",
                    email: "user-2@team-timesheets.com",
                }),
            ])
        });

        it("should set the activeDocument with data for the user", async () => {
            const fakeAuth = new FakeAuth();
            const authStore = createAuthStore(fakeAuth, firestore);

            await waitFor(() => expect(authStore.collection.isFetched).toBeTruthy());

            fakeAuth.authenticate({
                uid: "id-1",
                email: "user-1@team-timesheets.com",
                displayName: "User 1",
            });

            await waitFor(() => expect(authStore.activeDocument).toEqual(
                expect.objectContaining({
                    uid: "id-1",
                    name: "User 1",
                    email: "user-1@team-timesheets.com",
                    bar: "foo",
                })
            ));

            authStore.dispose();
        });

        it("should set and patch the activeDocument with data for the user", async () => {
            const fakeAuth = new FakeAuth();
            const authStore = new AuthStore<AuthStoreUser & { bar: string }>(
                {
                    firestore: firestore,
                    auth: fakeAuth as unknown as firebase.auth.Auth,
                },
                undefined,
                {
                    patchExistingUser: async (userDoc, usersCollection, fbUser) => {
                        if (!userDoc.data!.bar) {
                            // backwords compatibility, get single user by id and patch user data
                            await usersCollection.updateAsync(
                                {
                                    bar: "foo",
                                },
                                fbUser.uid,
                            );
                        }
                        return userDoc;
                    },
                }
            );

            fakeAuth.authenticate({
                uid: "id-2",
                email: "user-2@team-timesheets.com",
                displayName: "User 2",
            });

            await waitFor(() => expect(authStore.activeDocument).toEqual(
                expect.objectContaining({
                    uid: "id-2",
                    name: "User 2",
                    email: "user-2@team-timesheets.com",
                    bar: "foo",
                })
            ));

            authStore.dispose();
        });
    });
    describe("signOut", () => {
        it("should call onSignOut", () => {
            const fakeAuth = new FakeAuth();
            const authStore = new AuthStore(
                {
                    firestore: firestore,
                    auth: fakeAuth as unknown as firebase.auth.Auth,
                },
                undefined,
                {
                    onSignOut,
                }
            );

            authStore.signout();

            expect(onSignOut).toHaveBeenCalled();
        });

        it("should reset activeDocument and activeDocumentId", async () => {
            const fakeAuth = new FakeAuth();
            const authStore = createAuthStore(fakeAuth, firestore);

            fakeAuth.authenticate({
                uid: "id-1",
            });

            await waitFor(async () => expect(authStore.activeDocumentId).toBe("id-1"));

            authStore.signout();

            await waitFor(async () => expect(authStore.activeDocumentId).toBeUndefined());
        });
    });

    describe("getLoggedInUser", () => {
        it("should resolve with user when authenticated", () => {
            const fakeAuth = new FakeAuth();
            const authStore = createAuthStore(fakeAuth, firestore);

            const promise = authStore.getLoggedInUser();

            fakeAuth.authenticate({ uid: "1" });

            expect(promise).resolves.toEqual(
                expect.objectContaining({
                    uid: "1",
                }),
            );
        });

        it("should reject when user is not authenticated", () => {
            const fakeAuth = new FakeAuth();
            const authStore = createAuthStore(fakeAuth, firestore);

            const promise = authStore.getLoggedInUser();

            fakeAuth.authenticate(undefined);

            expect(promise).rejects.toEqual(
                expect.objectContaining({
                    message: "Not authenticated",
                }),
            );
        });
    });
});
