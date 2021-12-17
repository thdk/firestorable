import { Collection, ICollectionOptions } from "../..";
import { logger } from "../../__test-utils__";


import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, CollectionReference, limit } from "firebase/firestore";
const projectId = "test-query-async";

describe("Collection.queryAsync", () => {
    let firestore: any;
    let testEnv: RulesTestEnvironment;
    let collectionRef: CollectionReference<any>;
    let booksCollection: Collection<{ value: string }>;

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


    afterAll(() => testEnv.cleanup());

    beforeEach(async () => {
        await testEnv.clearFirestore()
        booksCollection = createCollection();

        return Promise.all(
            [
                booksCollection.addAsync({ value: "A" }),
                booksCollection.addAsync({ value: "B" }),
            ],
        );
    });

    afterEach(() => booksCollection.dispose());

    test("it should return all docs when no constraints are given", async () => {
        const books = await booksCollection.queryAsync();

        expect(
            books.length,
        ).toBe(2);
        
    });

    test("it should limit the docs when constraints are given", async () => {
        const books = await booksCollection.queryAsync(
            limit(1)
        );

        expect(
            books.length,
        ).toBe(1);
        
    });
});