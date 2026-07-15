
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'OPEN_NEW_TAB' && message.url) {
        chrome.tabs.create({
            url: message.url,
            active: false,
            openerTabId: sender.tab?.id,
            index: sender.tab ? sender.tab.index + 1 : undefined
        });
    }
});