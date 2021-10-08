import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { waitFor } from "@testing-library/dom";

import { Doc } from "../..";
import { IBook, IBookData } from "../../__test-utils__";

import { collection, deleteDoc } from "@firebase/firestore";
import { CollectionReference, doc, setDoc } from "firebase/firestore";

function deserializeBook(book: IBookData): IBook {
    const { award, ...otherProps } = book;
    const newValue = award === null || award === undefined
        ? undefined
        : award;

    return { ...otherProps, award: newValue };
}

const projectId = "test-document-watch";


const dummyBook = {
    total: 5,
    name: "book a",
    award: null,
};

describe("Document.watch", () => {
    let testEnv: RulesTestEnvironment;
    let firestore: any;
    let collectionRef: CollectionReference;
    
    const createDoc = (watch: boolean, id?: string) => {
        return new Doc<IBook, any>(collection(firestore, "books"), dummyBook, {
            deserialize: deserializeBook,
            watch,
        }, id);
    };
    
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
        await testEnv.clearFirestore();
        return setDoc(doc(collectionRef, "id-A"), dummyBook);
    });

    describe("when watch = true", () => {
        let document: Doc<IBook, IBookData>;

        beforeEach(() => {
            document = createDoc(true, "id-A");
        });

        describe("when document gets deleted in the database", () => {
            it("should set data property of document to undefined", async () => {
                await deleteDoc(doc(collectionRef, "id-A"))

                await waitFor(
                    () => expect(document.data).toBe(undefined),
                    {
                        timeout: 8888,
                    },
                );
            });
        });

        describe("when document is updated in database", () => {
            test("it should respond to changes", () => {
                return setDoc(doc(collectionRef, "id-A"), {
                        award: 3,
                    })
                    .then(() => {
                        return waitFor(() => expect(document.data!.award).toBe(3));
                    });
            });
        });

        describe("when unwatch() is called on document", () => {
            test("it should not respond to changes anymore", () => {
                document.unwatch();

                return setDoc(doc(collectionRef, "id-A"), {
                        award: 3,
                    })
                    .then(() => {
                        expect(document.data?.award).toBe(undefined);
                    });
            });
        });
    });

    describe("when watch = false", () => {
        let document: Doc<IBook, IBookData>;

        beforeEach(() => {
            document = createDoc(false);
        });

        describe("when document gets deleted in the database", () => {
            it("should NOT set data property of document to undefined", () => {
                return deleteDoc(doc(collectionRef, "id-A"))
                    .then(() => {
                        expect(document.data).toEqual({
                            name: "book a",
                            award: undefined,
                            total: 5,
                        });
                    });
            });
        });
    });
});
