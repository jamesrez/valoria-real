// Check if menu already exists
let menuThing = Array.from(things.values()).find(t => t.name === 'Menu');
let menuItem1 = Array.from(things.values()).find(t => t.name === 'File Menu');
let menuItem1_1 = Array.from(things.values()).find(t => t.name === 'New File');
let menuItem1_1_1 = Array.from(things.values()).find(t => t.name === 'JavaScript File');

// Only create if they don't exist
if (!menuThing) {
    menuThing = new Thing({
        name: 'Menu',
        components: {
            html: `
                <nav class="menu">
                    <div class="children"></div>
                </nav>
            `,
            css: `
                .menu {
                    background: #333;
                    padding: 10px;
                    margin: 10px;
                    border-radius: 4px;
                    width: 200px;
                }
            `
        }
    });
    things.set(menuThing.id, menuThing);
}

if (!menuItem1) {
    menuItem1 = new Thing({
        name: 'File Menu',
        components: {
            html: `
                <div class="menu-item">
                    File
                    <div class="dropdown">
                        <div class="children"></div>
                    </div>
                </div>
            `,
            css: `
                .menu-item {
                    color: white;
                    position: relative;
                    display: inline-block;
                    padding: 5px 15px;
                    cursor: pointer;
                    background: #444;
                    border-radius: 3px;
                }
                .dropdown {
                    display: none;
                    position: absolute;
                    background: #444;
                    min-width: 150px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                    border-radius: 3px;
                    margin-top: 5px;
                }
                .menu-item:hover .dropdown {
                    display: block;
                }
            `
        }
    });
    things.set(menuItem1.id, menuItem1);
}

if (!menuItem1_1) {
    menuItem1_1 = new Thing({
        name: 'New File',
        components: {
            html: `
                <div class="sub-menu">
                    New File
                    <div class="nested-dropdown">
                        <div class="children"></div>
                    </div>
                </div>
            `,
            css: `
                .sub-menu {
                    padding: 8px 15px;
                    color: white;
                    position: relative;
                }
                .sub-menu:hover {
                    background: #555;
                }
                .nested-dropdown {
                    display: none;
                    position: absolute;
                    left: 100%;
                    top: 0;
                    background: #444;
                }
                .sub-menu:hover .nested-dropdown {
                    display: block;
                }
            `
        }
    });
    things.set(menuItem1_1.id, menuItem1_1);
}

if (!menuItem1_1_1) {
    menuItem1_1_1 = new Thing({
        name: 'JavaScript File',
        components: {
            html: `
                <div class="menu-option">JavaScript File</div>
            `,
            css: `
                .menu-option {
                    padding: 8px 15px;
                    color: white;
                }
                .menu-option:hover {
                    background: #555;
                }
            `
        }
    });
    things.set(menuItem1_1_1.id, menuItem1_1_1);
}

// Only build hierarchy if needed
if (!menuThing.children.includes(menuItem1?.id)) {
    menuThing.addChild(menuItem1);
}
if (!menuItem1.children.includes(menuItem1_1?.id)) {
    menuItem1.addChild(menuItem1_1);
}
if (!menuItem1_1.children.includes(menuItem1_1_1?.id)) {
    menuItem1_1.addChild(menuItem1_1_1);
}

// Only add to system if needed
if (!systemThing.children.includes(menuThing.id)) {
    systemThing.addChild(menuThing);
} 