import type firebase from "firebase/compat";

import { action, transaction, observable, makeObservable } from "mobx";
import { Collection } from "../../collection";
import { Doc } from "../../document";
import { CrudStore, StoreOptions } from "../crud-store";

export interface AuthStoreUser {
    name?: string;
    email?: string;
    uid: string;
}

/**
 * Resolves with firbase.User if user is logged in
 * Rejects if no user is logged in
 */
export const getLoggedInUser = (auth?: firebase.auth.Auth) => {
    if (!auth) {
        return Promise.reject(new Error("No auth provided"));
    }

    return new Promise<firebase.User>((resolve, reject) => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            unsubscribe();
            if (user) resolve(user);
            else reject(new Error("Not authenticated"));
        });
    });
};

export class AuthStore<T extends AuthStoreUser = AuthStoreUser, K = T> extends CrudStore<T, K> {
    isAuthInitialised = false;

    private auth?: firebase.auth.Auth;
    private patchExistingUser?(
        user: Doc<T, K>,
        collection: Collection<T, K>,
        fbUser: firebase.User,
    ): Promise<Doc<T, K>>;
    private onSignOut?(): void;

    private disposables: (() => void)[] = [];
    constructor(
        {
            firestore,
            auth,
        }: {
            firestore: firebase.firestore.Firestore,
            auth?: firebase.auth.Auth,
        },
        storeOptions: StoreOptions<T, K> = {
            collection: "users",
        },
        {
            patchExistingUser,
            onSignOut,
        }: {
            patchExistingUser?(
                user: Doc<T, K>,
                collection: Collection<T, K>,
                fbUser: firebase.User,
            ): Promise<Doc<T, K>>;
            onSignOut?(): void;
        } = {},
    ) {
        super(
            { ...storeOptions },
            {
                firestore,
            }
        );

        makeObservable<AuthStore<T,K>, "getAuthUserSuccess" | "getUserError">(this, {
            isAuthInitialised: observable.ref,
            setUser: action,
            getAuthUserSuccess: action.bound,
            getUserError: action.bound
        });

        this.auth = auth;
        this.patchExistingUser = patchExistingUser;
        this.onSignOut = onSignOut;

        this.auth && this.disposables.push(
            this.auth.onAuthStateChanged(this.setUser.bind(this)),
        );
    }

    public setUser(fbUser: firebase.User | null): void {
        if (!fbUser) {
            transaction(() => {
                this.isAuthInitialised = true;
                this.setActiveDocumentId(undefined);
            });

            if (this.onSignOut) {
                this.onSignOut();
            }
        } else {
            this.getAuthenticatedUserAsync(fbUser)
                .then(
                    (user) => {
                        this.getAuthUserSuccess(user);
                    },
                    async () => {
                        const authStoreUser = {
                            uid: fbUser.uid,
                        } as Partial<T>;

                        if (fbUser.displayName) {
                            authStoreUser.name = fbUser.displayName;
                        }

                        if (fbUser.email) {
                            authStoreUser.email = fbUser.email;
                        }

                        const newDocument = await this.createNewDocument(authStoreUser);

                        this.addDocument(
                            newDocument as T,
                            fbUser.uid
                        ).then(
                            (userId) => {
                                // get the newly registered user
                                return this.collection.getAsync(userId)
                                    .then(
                                        (user) => this.getAuthUserSuccess(user),
                                        this.getUserError,
                                    );
                            },
                            (error) => console.log(`${error}\nCoudn't save newly registered user. `),
                        );
                    });
        }
    }

    private getAuthenticatedUserAsync(fbUser: firebase.User): Promise<Doc<T, K>> {
        return this.collection.getAsync(fbUser.uid)
            .then((userDoc) => {
                return this.patchExistingUser
                    ? this.patchExistingUser(
                        userDoc,
                        this.collection,
                        fbUser,
                    )
                    : userDoc;
            });
    }

    private getAuthUserSuccess = (authUser: Doc<T, K>) => {
        transaction(() => {
            this.isAuthInitialised = true;
            this.setActiveDocumentId(authUser.id);
        });
    };

    private getUserError = (error: any) => {
        console.error(error);
    };

    public signout(): void {
        this.setUser(null);
        this.auth && this.auth.signOut();
    }

    public getLoggedInUser() {
        return getLoggedInUser(this.auth);
    }

    public dispose() {
        this.disposables.reverse().forEach(fn => fn());
        super.dispose();
    }
}
