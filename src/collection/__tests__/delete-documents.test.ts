import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { Collection, ICollectionOptions, RealtimeMode } from "../..";
import { logger } from "../../__test-utils__";

import { collection, CollectionReference, doc, getDoc, setDoc } from "firebase/firestore";

const projectId = "test-delete-documents";
describe("Collection.deleteAsync", () => {
    let collectionRef: CollectionReference<any>;
    let firestore: any;
    let testEnv: RulesTestEnvironment;

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId,
            firestore: {
                host: "localhost",
                port: 8080,
            }
        });

        firestore = testEnv.unauthenticatedContext().firestore();
        collectionRef = collection(firestore, "books");
    });


    function createCollection<T, K = T>(options?: ICollectionOptions<T, K>) {
        return new Collection<T, K>(
            firestore,
            collectionRef,
            options,
            {
                logger: logger
            }
        );
    }

    afterAll(() => testEnv.cleanup());

    beforeEach(async () => {
        await testEnv.clearFirestore()
        // Add initial data
        return Promise.all([
            setDoc(doc(collectionRef, "id1"), { total: 1, name: "A" }),
            setDoc(doc(collectionRef, "id2"), { total: 1, name: "B" }),
            setDoc(doc(collectionRef, "id3"), { total: 1, name: "C" }),
            setDoc(doc(collectionRef, "id4"), { total: 1, name: "C" }),
        ]);
    });

    describe("when collection is not filtered with a query", () => {
        it("should delete the document with the given id", () => {
            const collection = createCollection({ realtimeMode: RealtimeMode.off });

            return collection.deleteAsync("id2")
                .then(() => {
                    return getDoc(doc(collectionRef, "id2"))
                        .then(doc => {
                            expect(doc.exists()).toBe(false);
                        });
                });
        });

        it("should delete multiple documents", () => {
            const collection = createCollection();

            return collection.deleteAsync("id2", "id3")
                .then(() => {
                    return Promise.all([
                        getDoc(doc(collectionRef, "id2")),
                        getDoc(doc(collectionRef, "id3")),
                    ])
                        .then(([snapshot1, snapshot2]) => {
                            expect(snapshot1.exists()).toBe(false);
                            expect(snapshot2.exists()).toBe(false);
                        });
                });
        });
    });
});
