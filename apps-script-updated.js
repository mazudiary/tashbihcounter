/**
 * Apps Script backend for Tasbih Tracker
 * Sheets expected:
 *  - user           (columns: UserID | Name | Password)
 *  - tashbih_data   (columns: Timestamp | UserID | Name | TasbihName | Count | SessionID)
 *
 * Deploy as Web App (Anyone with link).
 */

function doPost(e) {
  try {
    // Check if e (event) parameter exists
    if (!e) {
      return jsonResponse({
        success: false,
        message: "No event parameter received",
        error: "Event parameter is undefined",
      });
    }

    // ensure we can parse parameters
    var params = e.parameter || {};
    var action = params.action || "";

    // Log the received data for debugging (remove in production)
    console.log("Received request:", {
      parameters: params,
      action: action,
      postData: e.postData,
    });

    // Handle ping/test requests first (before checking sheets)
    if (action === "ping" || action === "test") {
      return jsonResponse({
        success: true,
        message: "Apps Script is working!",
        timestamp: new Date().toISOString(),
        action: action,
        receivedParams: params,
      });
    }

    // IMPORTANT: Replace this with your actual Google Sheet ID
    var SHEET_ID = "1RzA6SLpNZF7sg37woS5NUzZZT6jUKeFC23pNCoPE0d4";

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var userSheet = ss.getSheetByName("user");
    var dataSheet = ss.getSheetByName("tashbih_data");

    if (!userSheet || !dataSheet) {
      return jsonResponse({
        success: false,
        message:
          "Required sheets (user, tashbih_data) not found. Please create these sheets with proper headers.",
        missingSheets: {
          user: !userSheet,
          tashbih_data: !dataSheet,
        },
      });
    }

    if (action === "createUser") {
      var userId = params.userId;
      var name = params.name;
      var password = params.password;
      if (!userId || !name || !password)
        return jsonResponse({ success: false, message: "Missing fields" });

      // check duplicate userId
      var users = userSheet
        .getRange(2, 1, userSheet.getLastRow() - 1, 1)
        .getValues()
        .flat();
      if (users.indexOf(userId) !== -1) {
        return jsonResponse({
          success: false,
          message: "UserID already exists",
        });
      }
      // append new user
      userSheet.appendRow([userId, name, password]);
      return jsonResponse({ success: true, message: "User created" });
    }

    if (action === "login") {
      var userId = params.userId;
      var password = params.password;
      if (!userId || !password)
        return jsonResponse({ success: false, message: "Missing credentials" });

      var lastRow = userSheet.getLastRow();
      if (lastRow < 2)
        return jsonResponse({ success: false, message: "User not found" });

      var range = userSheet.getRange(2, 1, lastRow - 1, 3);
      var vals = range.getValues();
      for (var i = 0; i < vals.length; i++) {
        if (
          String(vals[i][0]) === String(userId) &&
          String(vals[i][2]) === String(password)
        ) {
          return jsonResponse({ success: true, name: vals[i][1] });
        }
      }
      return jsonResponse({ success: false, message: "Invalid credentials" });
    }

    if (action === "saveTasbih") {
      var userId = params.userId;
      var name = params.name || "";
      var dataStr = params.data;
      if (!userId || !dataStr)
        return jsonResponse({ success: false, message: "Missing data" });

      // dataStr expected to be JSON: { sessionId: 'sess-..', counts: { 'SubhanAllah': 20, ... } }
      try {
        var payload = JSON.parse(dataStr);
      } catch (err) {
        // support older format: where dataStr is just JSON of counts
        try {
          payload = {
            sessionId: params.sessionId || "",
            counts: JSON.parse(params.data),
          };
        } catch (e) {
          return jsonResponse({ success: false, message: "Invalid JSON data" });
        }
      }

      var sessionId = payload.sessionId || Utilities.getUuid();
      var counts = payload.counts || payload; // maybe payload itself is counts

      var ts = new Date();
      // append one row per tasbih
      var appendRows = [];
      for (var tasbihName in counts) {
        if (!counts.hasOwnProperty(tasbihName)) continue;
        var cnt = Number(counts[tasbihName]) || 0;
        if (cnt <= 0) continue; // skip zero counts to avoid clutter (optional)
        appendRows.push([ts, userId, name, tasbihName, cnt, sessionId]);
      }
      if (appendRows.length === 0) {
        return jsonResponse({
          success: true,
          message: "No non-zero counts to save",
        });
      }

      try {
        dataSheet
          .getRange(dataSheet.getLastRow() + 1, 1, appendRows.length, 6)
          .setValues(appendRows);
        return jsonResponse({
          success: true,
          message: "Saved " + appendRows.length + " tasbih items",
        });
      } catch (err) {
        return jsonResponse({
          success: false,
          message: "Error saving to sheet: " + err.message,
          error: err.toString(),
        });
      }
    }

    if (action === "getProgress") {
      var userId = params.userId;
      if (!userId)
        return jsonResponse({ success: false, message: "Missing userId" });

      try {
        var rows = dataSheet.getDataRange().getValues();
        // rows include header row; find indices from header for safety (but we assume header order)
        // header: Timestamp | UserID | Name | TasbihName | Count | SessionID
        var totals = {};
        var today = new Date();
        var tz = ss.getSpreadsheetTimeZone();
        var todayStr = Utilities.formatDate(today, tz, "yyyy-MM-dd");

        for (var i = 1; i < rows.length; i++) {
          var row = rows[i];
          var ts = row[0];
          var rowUser = String(row[1] || "");
          if (rowUser !== String(userId)) continue;
          var tasbihName = row[3];
          var cnt = Number(row[4]) || 0;
          // check same day
          var rowDateStr = "";
          if (ts instanceof Date) {
            rowDateStr = Utilities.formatDate(ts, tz, "yyyy-MM-dd");
          } else {
            // attempt parse if string
            try {
              rowDateStr = Utilities.formatDate(new Date(ts), tz, "yyyy-MM-dd");
            } catch (e) {
              rowDateStr = "";
            }
          }
          if (rowDateStr === todayStr) {
            totals[tasbihName] = (totals[tasbihName] || 0) + cnt;
          }
        }

        // if no entries, return empty object
        return jsonResponse(totals);
      } catch (err) {
        return jsonResponse({
          success: false,
          message: "Error reading progress: " + err.message,
          error: err.toString(),
        });
      }
    }

    return jsonResponse({
      success: false,
      message: "Unknown action: " + action,
    });
  } catch (globalError) {
    // Catch any unexpected errors
    return jsonResponse({
      success: false,
      message: "Unexpected error occurred: " + globalError.message,
      error: globalError.toString(),
      stack: globalError.stack,
    });
  }
}

// Handle GET requests (though we mainly use POST)
function doGet(e) {
  try {
    return jsonResponse({
      success: true,
      message: "Tasbih Tracker Apps Script is running",
      timestamp: new Date().toISOString(),
      note: "Use POST requests for API calls",
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      message: "Error in doGet: " + error.message,
      error: error.toString(),
    });
  }
}

// Helpers
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
