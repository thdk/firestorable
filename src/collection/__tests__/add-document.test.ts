import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { ICollectionOptions, Collection } from "../..";
import { logger } from "../../__test-utils__";

import { collection, CollectionReference, deleteField, doc, getDoc } from "firebase/firestore";
interface IBook {
    name: string;
    total: number;
    award?: string;
    isDeleted?: boolean;
}

describe("Collection.addAsync", () => {
    let testEnv: RulesTestEnvironment;
    let bookCollection: Collection<IBook>;
    let collectionRef: CollectionReference<any>;
    let firestore: any;

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
        collectionRef = collection(firestore, "books");
    });

    beforeEach(() => {
        bookCollection = createCollection<IBook>({
            serialize: data => {
                if (!data) {
                    throw new Error("Deleting not supported");
                }
                const firestoreData: any = {
                    award: deleteField(),
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

                return bookCollection.addAsync({
                    total: 11,
                    name: "Book"
                })
                    .then(id => {
                        return getDoc(doc(collectionRef, id))
                            .then(snapshot => {
                                expect(snapshot.exists()).toBe(true);
                            });
                    });
            });
        });

        describe("when a forced id is provided", () => {
            test("it should add the document with the given id", () => {

                return bookCollection.addAsync(
                    {
                        name: "Book",
                        total: 11,
                    },
                    "given-id"
                )
                    .then(() => {
                        return getDoc(doc(collectionRef, "given-id"))
                            .then(snapshot => {
                                expect(snapshot.exists()).toBe(true);
                            });
                    });
            });
        });
    });

    describe("Adding multiple documents", () => {
        test("it should add the documents with generated ids", () => {
            return bookCollection.addAsync([
                { total: 11, name: "Book" },
                { total: 22, name: "Book 2" }
            ])
                .then(ids => {
                    return Promise.all(
                        [
                            getDoc(doc(collectionRef, ids[0])),
                            getDoc(doc(collectionRef, ids[1]))
                        ]
                    ).then(([snapshot1, snapshot2]) => {
                        expect(snapshot1.exists()).toBe(true);
                        expect(snapshot2.exists()).toBe(true);
                    });
                });
        });
    });
});
