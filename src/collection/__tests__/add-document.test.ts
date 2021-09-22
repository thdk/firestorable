import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { ICollectionOptions, Collection } from "../..";
import { logger } from "../../__test-utils__";

import firebase from "firebase/compat";

interface IBook {
    name: string;
    total: number;
    award?: string;
    isDeleted?: boolean;
}

describe("Collection.addAsync", () => {
    let testEnv: RulesTestEnvironment;
    let collection: Collection<IBook>;
    let collectionRef: firebase.firestore.CollectionReference;
    let firestore: firebase.firestore.Firestore;

    function createCollection<T, K = T>(options?: ICollectionOptions<T, K>) {
        return new Collection<T, K>(
            firestore,
            collectionRef,
            options,
            {
                logger
            }
        );
    }

    beforeEach(() => testEnv.clearFirestore());

    afterAll(() => testEnv.cleanup());
    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: "test-add-documents",
            firestore: {
                host: "localhost",
                port: 8080,
            }
        });

        firestore = testEnv.unauthenticatedContext().firestore();
        collectionRef = firestore.collection("books");
    });

    beforeEach(() => {
        collection = createCollection<IBook>({
            serialize: data => {
                if (!data) {
                    throw new Error("Deleting not supported");
                }
                const firestoreData: any = {
                    award: firebase.firestore.FieldValue.delete(),
                    ...data
                };
                return firestoreData;

            },
            defaultSetOptions: {
                merge: true,
            },
        });
    });

    describe("Adding a single document", () => {
        describe("when no forced id is provided", () => {
            test("it should add the document with a generated id", () => {

                return collection.addAsync({
                    total: 11,
                    name: "Book"
                })
                    .then(id => {
                        return collectionRef.doc(id).get()
                            .then(snapshot => {
                                expect(snapshot.exists).toBe(true);
                            });
                    });
            });
        });

        describe("when a forced id is provided", () => {
            test("it should add the document with the given id", () => {

                return collection.addAsync(
                    {
                        name: "Book",
                        total: 11,
                    },
                    "given-id"
                )
                    .then(() => {
                        return collectionRef.doc("given-id").get()
                            .then(snapshot => {
                                expect(snapshot.exists).toBe(true);
                            });
                    });
            });
        });
    });

    describe("Adding multiple documents", () => {
        test("it should add the documents with generated ids", () => {
            return collection.addAsync([
                { total: 11, name: "Book" },
                { total: 22, name: "Book 2" }
            ])
                .then(ids => {
                    return Promise.all(
                        [
                            collectionRef.doc(ids[0]).get(),
                            collectionRef.doc(ids[1]).get(),
                        ]
                    ).then(([snapshot1, snapshot2]) => {
                        expect(snapshot1.exists).toBe(true);
                        expect(snapshot2.exists).toBe(true);
                    });
                });
        });
    });
});
