import { removeEventListeners } from "$/events.browser";
import { log } from "$/log.browser";

/**
 * Reconciles, i.e., merges, two DOM nodes. Inspired by React's reconciliation algorithm. (see
 * https://reactjs.org/docs/reconciliation.html)
 *
 * @param currentElement The element currently within the DOM that should be updated.
 * @param newElement The new element describing what the DOM will eventually look like.
 * @returns Returns either `currentElement` or `newElement`, depending on which of the two should
 *   remain/be placed into the DOM. The returned element has been reconciled recursively.
 */
export function reconcile(currentElement: Element, newElement: Element): Element {
    prepareScriptElements(newElement);
    return reconcileNode(currentElement, newElement);
}

function reconcileNode<T extends Node | Element>(currentNode: T, newNode: T): T {
    // We can't reconcile anything if the nodes' types don't match. E.g., we never even try to
    // reconcile a `div` with `span`, because most likely, the entire sub-DOM changed anyway.
    // This is also what React does.
    if (currentNode.nodeType !== newNode.nodeType || currentNode.nodeName !== newNode.nodeName) {
        return newNode;
    }

    if (currentNode.nodeType === Node.TEXT_NODE) {
        if (currentNode.nodeValue !== newNode.nodeValue) {
            currentNode.nodeValue = newNode.nodeValue;
        }
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
        // We always want to re-execute the code contained in a `script` tag. Hence, we return the new
        // node (and eventually remove the old one), so that the new code is executed (again).
        if (newNode.nodeName === "SCRIPT") {
            return newNode;
        }

        reconcileElement(currentNode as Element, newNode as Element);
    }

    return currentNode;
}

function reconcileElement(currentElement: Element, newElement: Element) {
    removeEventListeners(currentElement);
    reconcileAttributes(currentElement, newElement);

    const hasChildren = currentElement.firstChild ?? newElement.firstChild;
    if (hasChildren) {
        reconcileChildren(currentElement, newElement);
    }
}

function reconcileAttributes(currentElement: Element, newElement: Element) {
    // TODO: Merge styles!

    for (const newAttribute of newElement.getAttributeNames()) {
        if (newAttribute.startsWith("data-hy-view-") || newAttribute === "style") {
            continue;
        }

        const value = newElement.getAttribute(newAttribute);
        if (value && currentElement.getAttribute(newAttribute) !== value) {
            currentElement.setAttribute(newAttribute, value);
        }
    }

    for (const currentAttribute of currentElement.getAttributeNames()) {
        if (currentAttribute.startsWith("data-hy-view-") || currentAttribute === "style") {
            continue;
        }

        if (!newElement.hasAttribute(currentAttribute)) {
            currentElement.removeAttribute(currentAttribute);
        }
    }
}

function reconcileChildren(currentElement: Element, newElement: Element) {
    const currentKeyMap = getKeyMap(currentElement);
    const newKeyMap = getKeyMap(newElement);

    let currentChild = currentElement.firstChild;
    let newChild = newElement.firstChild;

    while (currentChild ?? newChild) {
        // There are more current children than new ones, so remove the superfluous ones.
        if (currentChild && !newChild) {
            const oldCurrent = currentChild;
            currentChild = currentChild.nextSibling;
            currentElement.removeChild(oldCurrent);
        }
        // There are more new children than current ones, so add them.
        else if (!currentChild && newChild) {
            const addChild = newChild;
            newChild = newChild.nextSibling;
            currentElement.appendChild(addChild);
        } else if (currentChild && newChild) {
            const currentKey =
                currentChild.nodeType === Node.ELEMENT_NODE
                    ? getKey(currentChild as Element)
                    : undefined;

            const newKey =
                newChild.nodeType === Node.ELEMENT_NODE ? getKey(newChild as Element) : undefined;

            if (newKey === currentKey) {
                // We can simply reconcile in this case as either both elements have the same
                // key and should be reconciled, or they both have no key, in which case they also
                // have to be reconciled.
                const element = reconcileNode(currentChild, newChild);

                const oldCurrent = currentChild;
                currentChild = currentChild.nextSibling;
                newChild = newChild.nextSibling;

                if (oldCurrent !== element) {
                    currentElement.replaceChild(element, oldCurrent);
                }
            } else {
                // The keys do not match. Why not?
                // - If the new child has no key, we have to consider it to be a new child that
                //   we have to add immediately.
                // - If the new child has an key, we might have a current child with the same key
                //   somewhere later in the tree. If so, reconcile and move it here. Otherwise,
                //   consider the child as a new child, add it, and push down the current child
                //   for consideration in the next iteration of the loop, where it might eventually
                //   be removed from the DOM if it never shows up as a new child.
                if (!newKey) {
                    // We have a new element without a key, so let's insert it before the current
                    // child with a key. A new child with the current child's key might later
                    // appear in the new children list.
                    const nextNewChild = newChild.nextSibling;
                    currentElement.insertBefore(newChild, currentChild);
                    newChild = nextNewChild;
                } else {
                    // We have new element with a key that we need to add or move here immediately.
                    // We'll consider the current child for reconcilation again in the next iteration
                    // of the loop.
                    const existingChild = currentKeyMap.get(newKey);
                    const nextNewChild = newChild.nextSibling;
                    if (existingChild) {
                        const element = reconcileNode(existingChild, newChild);
                        // If the existing child is already in the DOM before this location (this could
                        // happen if the same key is used multiple times), it's moved here. The algorithm
                        // still terminates because we make progress on the new children and we thus
                        // eventually stop moving the current ones around.
                        currentElement.insertBefore(element, currentChild);
                        if (element !== existingChild) {
                            // We weren't able to reconcile the old keyed child, so let's get rid of it.
                            existingChild.remove();
                        }
                    } else {
                        // Otherwise, this is a new child that we can add here.
                        currentElement.insertBefore(newChild, currentChild);
                    }

                    // If there is no new child with the current child's key, we can immediately remove
                    // it to reduce DOM operations.
                    if (currentKey && !newKeyMap.get(currentKey)) {
                        const childToRemove = currentChild;
                        currentChild = currentChild.nextSibling;
                        childToRemove.remove();
                    }

                    newChild = nextNewChild;
                }
            }
        }
    }
}

function getKey(element: Element) {
    return element.getAttribute("data-hy-key");
}

function getKeyMap(element: Element) {
    const keyMap = new Map<string, Element>();

    for (let child = element.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === Node.ELEMENT_NODE) {
            const elementChild = child as Element;
            const key = getKey(elementChild);

            if (key) {
                if (keyMap.has(key)) {
                    log.warn(`Key '${key}' is used more than once.`);
                }
                keyMap.set(key, elementChild);
            }
        }
    }

    return keyMap;
}

/**
 * Prepares new `script` elements returned from the server so that they can be executed once they
 * are added to the DOM. The way we parse the HTML, all `script` tags are in an disabled state, so
 * we have to create new, enabled ones. Moreover, we have to obtain the CSP nonce from the document
 * in order to be able to use the correct nonces for all `script` tags during reconciliation. When
 * frames obtain additional HTML from the server, any new `script` tags use a different nonce, and
 * hence the browser would block script execution if we didn't set the original nonce of the current
 * page.
 */
function prepareScriptElements(newElement: Element) {
    const cspNonce = (
        document.querySelector('meta[name="hy-csp-nonce"]') as HTMLMetaElement | undefined
    )?.content;

    // Unfortunately, when using `DOMParser.praseFromString`, all `script` elements are disabled, see
    // https://www.w3.org/TR/DOM-Parsing/#widl-DOMParser-parseFromString-Document-DOMString-str-SupportedType-type
    // So we have to create a new, enabled clone of each `script` element found in the server's HTML response.
    // However, if we did that and just replaced the original `script` elements with these clones within
    // `newElement` itself, they would become disabled again.
    // We solve this by first creating a new `DocumentFragment`, moving the original `newElement` into it, cloning
    // all of the `script` elements, and replacing the original `script`s with their clones directly within
    // `newElement`, which can then subsequently be used for reconciliation.
    const fragment = document.createDocumentFragment();
    fragment.appendChild(newElement);

    fragment.querySelectorAll("script").forEach((currentScript) => {
        const newScript = document.createElement("script");

        for (const attribute of currentScript.getAttributeNames()) {
            const value = newScript.getAttribute(attribute);
            if (value) {
                newScript.setAttribute(attribute, value);
            }
        }

        newScript.textContent = currentScript.textContent;
        newScript.async = false;
        newScript.nonce = cspNonce;

        currentScript.parentNode!.replaceChild(newScript, currentScript);
    });
}
