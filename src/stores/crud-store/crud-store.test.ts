import { CrudStore, StoreOptions } from "./index";
import { waitFor } from "@testing-library/dom";
import { FetchMode } from "../../collection";
import { reaction } from "mobx";
import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import type firebase from "firebase/compat";

const collection = "books";
const projectId = "crud-store-test";

const createCrudStore = async (firestore: firebase.firestore.Firestore,  options: Partial<StoreOptions> = {}, preFetch = true) => {
    const crud = new CrudStore({
        collection,
        collectionOptions: {
            fetchMode: FetchMode.manual,
        },
        ...options,
    },
        {
            firestore,
        },
    );

    if (preFetch) {
        await crud.collection.fetchAsync();
    }
    return crud;
}

describe("CrudStore", () => {
    let testEnv: RulesTestEnvironment;
    let collectionRef: firebase.firestore.CollectionReference;
    let firestore: firebase.firestore.Firestore;

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId,
            firestore: {
                host: "localhost",
                port: 8080,
            }
        });

        firestore = testEnv.unauthenticatedContext().firestore();
        collectionRef = firestore.collection(collection);
    });

    let crud: CrudStore;
    beforeEach(async () => {
        crud = await createCrudStore(testEnv.unauthenticatedContext().firestore());
    });

    afterEach(async () => {
        crud.dispose();
        await testEnv.clearFirestore();
    });

    afterAll(() => testEnv.cleanup());

    describe("addDocument & deleteDocument", () => {
        it("should add/delete a document to/from the collection", async () => {
            expect(crud.collection.docs.length).toBe(0);

            const id = await crud.addDocument({ id: 1 });

            await waitFor(() => expect(
                crud.collection.docs.map(d => d.data)
            ).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ id: 1 }),
                ]),
            ));

            await crud.deleteDocument(id);

            await waitFor(
                () => expect(
                    crud.collection.docs.length
                ).toEqual(0),
            );
        });
    });

    describe("addDocuments & deleteDocuments", () => {
        it("should add/remove documents to/from the collection", async () => {
            expect(crud.collection.docs.length).toBe(0);

            const ids = await crud.addDocuments([{ id: 1 }, { id: 2 }]);

            await waitFor(() => expect(
                crud.collection.docs.map(d => d.data)
            ).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ id: 1 }),
                    expect.objectContaining({ id: 2 }),
                ]),
            ));

            await crud.deleteDocuments(undefined, ...ids);

            await waitFor(
                () => expect(
                    crud.collection.docs.length
                ).toEqual(0),
            );
        });

        it("should not crash on an empty array", async () => {
            expect(crud.collection.docs.length).toBe(0);

            await crud.addDocuments([]);

            await crud.deleteDocuments(undefined);

            await waitFor(
                () => expect(
                    crud.collection.docs.length
                ).toEqual(0),
            );
        });

        it("should not delete documents when useFlag=true", async () => {
            expect(crud.collection.docs.length).toBe(0);

            const id = await crud.addDocument({ id: 1 });

            await waitFor(() => expect(
                crud.collection.docs.map(d => d.data)
            ).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ id: 1 }),
                ]),
            ));

            await crud.deleteDocument(id, { useFlag: true });

            await waitFor(
                () => expect(
                    crud.collection.docs.length
                ).toEqual(1),
            );
        })
    });

    describe("updateActiveDocument", () => {
        it("should update the active document", async () => {
            const docId = await crud.addDocument({ id: 1 });

            await crud.setActiveDocumentId(docId);

            await waitFor(() => expect(crud.activeDocument).toEqual(
                expect.objectContaining({
                    id: 1,
                }),
            ));

            reaction(() => crud.activeDocument, jest.fn());

            await crud.updateActiveDocument({ foo: "bar" });

            await waitFor(async () => {
                const doc = await collectionRef.doc(docId).get();
                expect(doc.data()).toEqual(
                    expect.objectContaining({
                        id: 1,
                        foo: "bar",
                    }),
                );
            });
        });

        it("should throw when there is no activeDocumentId", () => {
            expect(crud.activeDocumentId).toBeUndefined();

            expect(() => crud.updateActiveDocument({})).toThrow();
        });
    });

    describe("createNewDocument", () => {
        it("should clear the previous activeDocumentId", async () => {
            const id = await crud.addDocument({});
            crud.setActiveDocumentId(id);

            await crud.createNewDocument();

            expect(crud.activeDocumentId).toBeUndefined();
        });

        it("should set the activeDocument with default values", async () => {
            await waitFor(() => expect(crud.activeDocumentId).toBeUndefined());

            crud = await createCrudStore(firestore, {
                createNewDocumentDefaults: () => ( { bar: "default value" }),
            });

            if (crud.activeDocumentId) {
                throw new Error(crud.activeDocumentId);
            }

            const newDoc = await crud.createNewDocument();

            expect(newDoc.bar).toBe("default value");

            expect(crud.activeDocument).toEqual(
                expect.objectContaining({
                    bar: "default value",
                }),
            );
        })
    });

    describe("activeDocument", () => {
        it("should return the data of the document when activeDocumentId is set", async () => {
            await collectionRef.doc("id-1").set({ foo: "bar" });
            const crud = await createCrudStore(firestore);

            await waitFor(() => expect(crud.collection.isFetched).toBeTruthy());

            crud.setActiveDocumentId("id-1");

            await waitFor(() => expect(crud.activeDocument).toEqual(
                expect.objectContaining({
                    foo: "bar",
                }))
            );
        });

        it("should eventually return the data of the document when activeDocumentId is set", async () => {
            await collectionRef.doc("id-1").set({ foo: "bar" });

            const crud = await createCrudStore(firestore, undefined, false);
            expect(crud.collection.isFetched).toBeFalsy();

            crud.setActiveDocumentId("id-1");

            await waitFor(() => expect(crud.activeDocument).toEqual(
                expect.objectContaining({
                    foo: "bar"
                })
            ));
        });

        it("should watch the data of the document when it's changed in the database", async () => {
            await collectionRef.doc("id-1").set({foo:"bar"});
            const crud = await createCrudStore(firestore);

            await waitFor(() => expect(crud.collection.isFetched).toBeTruthy());

            crud.setActiveDocumentId("id-1");

            await waitFor(() => expect(crud.activeDocument).toEqual(
                expect.objectContaining({
                    foo: "bar",
                }))
            );

            await collectionRef.doc("id-1").update({foo:"bar bar"});

            await waitFor(() => expect(crud.activeDocument).toEqual(
                expect.objectContaining({
                    foo: "bar bar",
                })),
            );
        });

        it("should be undefined when activeDocumentId is set to invalid document id", async () => {
            await collectionRef.doc("id-1").set({foo:"bar"});
            const crud = await createCrudStore(firestore);

            await waitFor(() => expect(crud.collection.isFetched).toBeTruthy());

            crud.setActiveDocumentId("id-1");

            await waitFor(() => expect(crud.activeDocument).toEqual(
                expect.objectContaining({
                    foo: "bar",
                }))
            );

            crud.setActiveDocumentId("id-2");

            await waitFor(() => expect(crud.activeDocument).toBeUndefined());
        });
    });
});
