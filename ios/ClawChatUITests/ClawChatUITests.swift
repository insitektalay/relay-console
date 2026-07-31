import XCTest

@MainActor
final class ClawChatUITests: XCTestCase {
    var app: XCUIApplication!
    
    override func setUp() async throws {
        continueAfterFailure = false
        app = XCUIApplication(bundleIdentifier: "com.example.relayconsole")
    }
    
    func attach(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
    
    func testSmokeTabNavigation() throws {
        app.launch()
        sleep(3)
        attach("01_initial_state")
        
        let tabBar = app.tabBars.firstMatch
        guard tabBar.exists else {
            throw XCTSkip("Main tab smoke test requires an authenticated session with a selected workspace.")
        }
        
        // Check Chats tab is active by default
        let chatsTab = tabBar.buttons["Chats"]
        XCTAssertTrue(chatsTab.exists, "Chats tab must exist")
        attach("02_chats_tab")
        
        // Navigate to Agents tab
        let agentsTab = tabBar.buttons["Agents"]
        XCTAssertTrue(agentsTab.exists, "Agents tab must exist")
        agentsTab.tap()
        sleep(3)
        attach("03_agents_tab")
        
        // Navigate to Relay Console index
        let consoleTab = tabBar.buttons["Console"]
        XCTAssertTrue(consoleTab.exists, "Console tab must exist")
        consoleTab.tap()
        sleep(2)
        attach("04_console_index")
        
        // Navigate back to Chats
        chatsTab.tap()
        sleep(2)
        attach("05_chats_with_threads")
        
        // Open first thread
        let firstCell = app.cells.firstMatch
        if firstCell.exists {
            firstCell.tap()
            sleep(3)
            attach("06_thread_detail")
            
            // Try to find message input field
            _ = app.textViews.firstMatch.exists
            attach("07_message_input_area")
            
            // Navigate back
            let backButton = app.navigationBars.buttons.firstMatch
            if backButton.exists {
                backButton.tap()
            }
            sleep(1)
        }
        
        // Try new chat compose
        let composeButton = app.buttons.matching(identifier: "compose").firstMatch
        if !composeButton.exists {
            // Try finding by label
            _ = app.buttons.count
            attach("08_available_buttons")
        }
        
        // Go to Agents and tap an agent
        guard app.tabBars.firstMatch.exists else {
            throw XCTSkip("Main tab bar disappeared during authenticated smoke flow.")
        }
        let currentAgentsTab = app.tabBars.firstMatch.buttons["Agents"]
        guard currentAgentsTab.exists else {
            throw XCTSkip("Agents tab is not reachable from the current smoke-test state.")
        }
        currentAgentsTab.tap()
        sleep(3)
        let firstAgent = app.cells.firstMatch
        if firstAgent.exists {
            firstAgent.tap()
            sleep(3)
            attach("09_agent_detail")
            
            // Go back
            let backButton = app.navigationBars.buttons.firstMatch
            if backButton.exists {
                backButton.tap()
            }
            sleep(1)
        }
        
        currentAgentsTab.tap()
        sleep(1)
        if app.buttons["Tasks"].exists {
            app.buttons["Tasks"].tap()
            sleep(2)
            attach("10_agent_tasks")
        }
    }

    func testPrimaryTabsAndConsoleIndex() throws {
        app.launch()

        let tabBar = app.tabBars.firstMatch
        guard tabBar.waitForExistence(timeout: 15) else {
            throw XCTSkip("Primary shell requires an authenticated session with a selected Railway workspace.")
        }

        XCTAssertTrue(tabBar.buttons["Chats"].exists)
        XCTAssertTrue(tabBar.buttons["Agents"].exists)
        XCTAssertTrue(tabBar.buttons["Console"].exists)
        XCTAssertFalse(tabBar.buttons["More"].exists)

        tabBar.buttons["Console"].tap()
        XCTAssertTrue(app.staticTexts["Console"].waitForExistence(timeout: 3))
        for destination in ["Artifacts", "Applications", "Approvals", "Settings"] {
            XCTAssertTrue(app.staticTexts[destination].exists, "\(destination) must be visible in the primary Relay section")
        }
        XCTAssertFalse(app.staticTexts["AgentOps HQ"].exists)
        XCTAssertFalse(app.staticTexts["Insights"].exists)
        attach("IOSUIUX-001-005-authenticated-console-index")
    }

    func testSignedOutRelayAuthNavigation() throws {
        app.launch()
        XCTAssertTrue(app.staticTexts["Email"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Password"].exists)
        XCTAssertTrue(app.buttons["Sign In"].exists)
        XCTAssertFalse(app.buttons["Sign In"].isEnabled)
        XCTAssertTrue(app.buttons["Create Account"].exists)
        attach("IOSUIUX-001-006-signed-out-login")

        app.buttons["Create Account"].tap()
        XCTAssertTrue(app.staticTexts["Create Account"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Full Name"].exists)
        XCTAssertTrue(app.staticTexts["Confirm Password"].exists)
        attach("IOSUIUX-001-006-registration")
    }

    func testLoginPasswordVisibilityToggle() throws {
        app.launchArguments = ["--relay-ui-testing-reset-auth"]
        app.launch()

        let securePasswordField = app.secureTextFields["login-password"]
        let visibilityToggle = app.buttons["login-password-visibility-toggle"]

        XCTAssertTrue(securePasswordField.waitForExistence(timeout: 10))
        XCTAssertTrue(visibilityToggle.exists)
        XCTAssertEqual(visibilityToggle.label, "Show password")

        securePasswordField.tap()
        securePasswordField.typeText("visible-password")
        visibilityToggle.tap()

        let visiblePasswordField = app.textFields["login-password"]
        XCTAssertTrue(visiblePasswordField.waitForExistence(timeout: 3))
        XCTAssertEqual(visiblePasswordField.value as? String, "visible-password")
        XCTAssertEqual(visibilityToggle.label, "Hide password")

        visibilityToggle.tap()
        XCTAssertTrue(app.secureTextFields["login-password"].waitForExistence(timeout: 3))
        XCTAssertEqual(visibilityToggle.label, "Show password")
    }

    func testUnattendedSignedOutAccessibilityAndInputMatrix() throws {
        XCUIDevice.shared.orientation = .portrait
        app.launchArguments = [
            "--relay-ui-testing-reset-auth",
            "-UIPreferredContentSizeCategoryName",
            "UICTContentSizeCategoryAccessibilityExtraExtraExtraLarge",
        ]
        app.launch()

        let emailField = app.textFields["login-email"]
        let passwordField = app.secureTextFields["login-password"]
        let signInButton = app.buttons["Sign In"]

        XCTAssertTrue(emailField.waitForExistence(timeout: 10))
        XCTAssertTrue(passwordField.exists)
        XCTAssertTrue(signInButton.exists)
        XCTAssertFalse(signInButton.isEnabled)
        XCTAssertFalse(emailField.label.isEmpty)
        XCTAssertFalse(passwordField.label.isEmpty)
        XCTAssertFalse(signInButton.label.isEmpty)
        try app.performAccessibilityAudit()

        emailField.tap()
        emailField.typeText("matrix@example.test")
        XCTAssertTrue(app.keyboards.firstMatch.exists)
        passwordField.tap()
        passwordField.typeText("unsubmitted-test-value")
        XCTAssertTrue(signInButton.isEnabled)
        attach("IOS-SIM-MATRIX-accessibility3-portrait-keyboard")

        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(emailField.waitForExistence(timeout: 5))
        XCTAssertTrue(passwordField.exists)
        XCTAssertTrue(signInButton.exists)
        XCTAssertEqual(emailField.value as? String, "matrix@example.test")
        attach("IOS-SIM-MATRIX-accessibility3-landscape-keyboard")

        XCUIDevice.shared.orientation = .portrait
    }

    func testChatsSearchAndNewChatNavigation() throws {
        app.launch()
        let tabBar = app.tabBars.firstMatch
        guard tabBar.waitForExistence(timeout: 15) else {
            throw XCTSkip("Chats navigation requires an authenticated Railway workspace session.")
        }
        tabBar.buttons["Chats"].tap()
        XCTAssertTrue(app.staticTexts["Chats"].waitForExistence(timeout: 3))
        XCTAssertFalse(app.staticTexts["ClawChat"].exists)
        XCTAssertTrue(app.buttons["Search chats"].exists)
        XCTAssertTrue(app.buttons["New chat"].exists)
        attach("IOSUIUX-001-007-live-chats")

        app.buttons["Search chats"].tap()
        XCTAssertTrue(app.textFields["Search Relay Console"].waitForExistence(timeout: 3))
        attach("IOSUIUX-001-007-live-search")
        app.buttons["Cancel"].tap()

        XCTAssertTrue(app.buttons["New chat"].waitForExistence(timeout: 3))
        app.buttons["New chat"].tap()
        XCTAssertTrue(app.navigationBars["New Chat"].waitForExistence(timeout: 3))
        for scope in ["Direct", "Team", "Department"] {
            XCTAssertTrue(app.buttons[scope].exists)
        }
        attach("IOSUIUX-001-007-live-new-chat")
    }

    func testReadOnlyThreadPresentation() throws {
        app.launch()
        let tabBar = app.tabBars.firstMatch
        guard tabBar.waitForExistence(timeout: 15) else {
            throw XCTSkip("Thread presentation requires an authenticated Railway workspace session.")
        }
        tabBar.buttons["Chats"].tap()
        guard app.cells.firstMatch.waitForExistence(timeout: 8) else {
            throw XCTSkip("The selected Railway workspace has no safe existing chat to inspect.")
        }

        app.cells.firstMatch.tap()
        XCTAssertTrue(app.buttons["Chat actions"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.buttons["Back to Chats"].exists)
        XCTAssertTrue(app.buttons["Add attachment"].exists)
        attach("IOSUIUX-001-008-live-thread-read-only")

        app.buttons["Chat actions"].tap()
        XCTAssertTrue(app.buttons["Chat Info"].waitForExistence(timeout: 3))
        attach("IOSUIUX-001-008-live-thread-actions")
    }

    func testAgentsFiveModeNavigation() throws {
        app.launch()
        let tabBar = app.tabBars.firstMatch
        guard tabBar.waitForExistence(timeout: 15) else {
            throw XCTSkip("Agents navigation requires an authenticated Railway workspace session.")
        }
        tabBar.buttons["Agents"].tap()
        XCTAssertTrue(app.buttons["Add Agent"].waitForExistence(timeout: 5))
        let modes = [
            ("Agents", "agents-mode-agents"),
            ("Structure", "agents-mode-structure"),
            ("Classification", "agents-mode-classification"),
            ("Work Calendar", "agents-mode-work-calendar"),
            ("Tasks", "agents-mode-tasks")
        ]
        for (mode, identifier) in modes {
            if identifier == "agents-mode-work-calendar" {
                app.scrollViews["agents-mode-tabs"].swipeLeft()
            }
            let button = app.buttons[identifier]
            XCTAssertTrue(button.exists, "\(mode) must be reachable from Agents")
            button.tap()
            XCTAssertTrue(app.buttons["Add Agent"].exists)
        }
        attach("IOSUIUX-001-009-live-five-mode-navigation")
    }

    func testAgentDetailAndGuardedSheets() throws {
        app.launch()
        let tabBar = app.tabBars.firstMatch
        guard tabBar.waitForExistence(timeout: 15) else {
            throw XCTSkip("Agent detail requires an authenticated Railway workspace session.")
        }
        tabBar.buttons["Agents"].tap()
        guard app.cells.firstMatch.waitForExistence(timeout: 8) else {
            throw XCTSkip("The selected Railway workspace has no existing agent to inspect safely.")
        }

        app.cells.firstMatch.tap()
        XCTAssertTrue(app.buttons["agent-detail-status"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["AGENT SUMMARY"].exists)
        XCTAssertTrue(app.staticTexts["KNOWLEDGE & WORKSPACE"].exists)
        attach("IOSUIUX-001-010-live-agent-detail")

        app.buttons["agent-detail-status"].tap()
        XCTAssertTrue(app.navigationBars["Set Status"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["agent-status-confirm"].exists)
        attach("IOSUIUX-001-010-live-status-sheet")
        app.buttons["Cancel"].tap()

        XCTAssertTrue(app.buttons["agent-detail-edit"].waitForExistence(timeout: 3))
        app.buttons["agent-detail-edit"].tap()
        XCTAssertTrue(app.navigationBars["Edit Agent"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["agent-edit-save"].exists)
        attach("IOSUIUX-001-010-live-edit-sheet")
        app.buttons["Cancel"].tap()
    }

    func testOrganisationStructureReadOnlyRoute() throws {
        app.launch()
        let tabBar = app.tabBars.firstMatch
        guard tabBar.waitForExistence(timeout: 15) else {
            throw XCTSkip("Organisation structure requires an authenticated Railway workspace session.")
        }

        tabBar.buttons["Agents"].tap()
        XCTAssertTrue(app.buttons["Add Agent"].waitForExistence(timeout: 5))
        app.buttons["agents-mode-structure"].tap()

        XCTAssertTrue(app.staticTexts["CREATE ORGANIZATION"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["CREATE DEPARTMENT"].exists)
        XCTAssertTrue(app.staticTexts["CREATE TEAM"].exists)
        attach("IOSUIUX-001-011-live-organisation-structure")
    }

    func testCuratedArtifactsReadOnlyRoute() throws {
        app.launch()
        let tabBar = app.tabBars.firstMatch
        guard tabBar.waitForExistence(timeout: 15) else {
            throw XCTSkip("Artifacts requires an authenticated Railway workspace session.")
        }

        tabBar.buttons["Console"].tap()
        for _ in 0..<5 { app.swipeDown() }
        let artifactsRow = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Artifacts")).firstMatch
        XCTAssertTrue(artifactsRow.waitForExistence(timeout: 8))
        artifactsRow.tap()
        XCTAssertTrue(app.textFields["Search artifacts"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.buttons["Refresh artifacts"].exists)
        attach("IOSUIUX-001-012-live-artifacts")
    }

    func testApplicationsCatalogReadOnlyRoute() throws {
        app.launch()
        let tabBar = app.tabBars.firstMatch
        guard tabBar.waitForExistence(timeout: 15) else {
            throw XCTSkip("Applications requires an authenticated Railway workspace session.")
        }

        tabBar.buttons["Console"].tap()
        for _ in 0..<5 { app.swipeDown() }
        let applicationsRow = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Applications")).firstMatch
        XCTAssertTrue(applicationsRow.waitForExistence(timeout: 8))
        applicationsRow.tap()
        XCTAssertTrue(app.textFields["Search providers"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.buttons["All categories"].exists)
        XCTAssertTrue(app.buttons["All availability"].exists)
        attach("IOSUIUX-001-013-live-applications")
    }

    func testApprovalsReadOnlyRoute() throws {
        app.launch()
        let tabBar = app.tabBars.firstMatch
        guard tabBar.waitForExistence(timeout: 15) else {
            throw XCTSkip("Approvals requires an authenticated Railway workspace session.")
        }

        tabBar.buttons["Console"].tap()
        for _ in 0..<5 { app.swipeDown() }
        let approvalsRow = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Approvals")).firstMatch
        XCTAssertTrue(approvalsRow.waitForExistence(timeout: 8))
        approvalsRow.tap()
        XCTAssertTrue(app.textFields["Search approvals"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.buttons["All statuses"].exists)
        app.scrollViews.firstMatch.swipeDown()
        attach("IOSUIUX-001-018-live-approvals")
    }

    func testSettingsReadOnlyRoute() throws {
        app.launch()
        let tabBar = app.tabBars.firstMatch
        guard tabBar.waitForExistence(timeout: 15) else {
            throw XCTSkip("Settings route requires an authenticated Railway session.")
        }

        tabBar.buttons["Console"].tap()
        for _ in 0..<5 { app.swipeDown() }
        let settingsRow = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Settings")).firstMatch
        XCTAssertTrue(settingsRow.waitForExistence(timeout: 8))
        settingsRow.tap()
        XCTAssertTrue(app.navigationBars["Settings"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.switches["Usage telemetry"].exists)
        XCTAssertTrue(app.staticTexts["Workspace"].exists)
        attach("IOSUIUX-001-019-live-settings")
    }

    func testSecurityReadOnlyRoute() throws {
        app.launch()
        let tabBar = app.tabBars.firstMatch
        guard tabBar.waitForExistence(timeout: 15) else {
            throw XCTSkip("Security route requires an authenticated Railway session.")
        }

        tabBar.buttons["Console"].tap()
        for _ in 0..<5 { app.swipeDown() }
        let settingsRow = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Settings")).firstMatch
        XCTAssertTrue(settingsRow.waitForExistence(timeout: 8))
        settingsRow.tap()
        XCTAssertTrue(app.navigationBars["Settings"].waitForExistence(timeout: 8))

        let securityRow = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Password & signed-in devices")).firstMatch
        for _ in 0..<5 where !securityRow.exists { app.swipeUp() }
        XCTAssertTrue(securityRow.waitForExistence(timeout: 5))
        securityRow.tap()
        XCTAssertTrue(app.navigationBars["Security"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.buttons["Change password"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["Mobile devices"].exists)
        XCTAssertTrue(app.staticTexts["Web browsers"].exists)
        attach("IOSUIUX-001-020-live-security")
    }

    func testOperationalRoutesReadOnly() throws {
        app.launch()
        let tabBar = app.tabBars.firstMatch
        guard tabBar.waitForExistence(timeout: 15) else {
            throw XCTSkip("Operational routes require an authenticated Railway workspace.")
        }

        tabBar.buttons["Console"].tap()
        let tasksRow = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Tasks")).firstMatch
        for _ in 0..<4 where !tasksRow.exists { app.swipeUp() }
        XCTAssertTrue(tasksRow.waitForExistence(timeout: 5))
        tasksRow.tap()
        XCTAssertTrue(app.navigationBars["Tasks"].waitForExistence(timeout: 8))
        attach("IOSUIUX-001-021-live-tasks")
        app.navigationBars.buttons.firstMatch.tap()

        let notificationsRow = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Notifications")).firstMatch
        XCTAssertTrue(notificationsRow.waitForExistence(timeout: 5))
        notificationsRow.tap()
        XCTAssertTrue(app.navigationBars["Notifications"].waitForExistence(timeout: 8))
        attach("IOSUIUX-001-021-live-notifications")
    }
}
