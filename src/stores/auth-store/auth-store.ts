import type firebase from "firebase";

import { action, transaction, observable } from "mobx";
import { Collection } from "../../Collection";
import { Doc } from "../../Document";
import { CrudStore, StoreOptions } from "../crud-store";
import { getLoggedInUser} from "../../utils/auth";

export interface AuthStoreUser {
    name?: string;
    email?: string;
    uid: string;
}

export class AuthStore<T extends AuthStoreUser = AuthStoreUser, K = T> extends CrudStore<T, K> {
    @observable.ref
    isAuthInitialised = false;

    private auth: firebase.auth.Auth;
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
            auth: firebase.auth.Auth,
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

        this.auth = auth;
        this.patchExistingUser = patchExistingUser;
        this.onSignOut = onSignOut;

        this.disposables.push(
            this.auth.onAuthStateChanged(this.setUser.bind(this)),
        );
    }

    @action
    // todo: should be private (currently public for tests)
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

    @action.bound
    private getAuthUserSuccess = (authUser: Doc<T, K>) => {
        transaction(() => {
            this.isAuthInitialised = true;
            this.setActiveDocumentId(authUser.id);
        });
    }

    @action.bound
    private getUserError = (error: any) => {
        console.error(error);
    }

    public signout(): void {
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
