<p align="center">
  <img src="wallbloom/desktop/icons/working.png" width="64" height="64" alt="WallWave">
</p>

<h1 align="center">WallWave</h1>

<p align="center">
  Wallpapers for your interests · automatic rotation · on-device AI
</p>

<p align="center">
  <strong><a href="https://github.com/yurgenium/WallWave/releases/download/v0.7.0/WallWave.exe">⬇ Download for Windows</a></strong><br>
  Windows x64 · Russian / English · 0.7.0 · Preview
</p>

<p align="center">
  <a href="README.md">Русский</a> · <strong>English</strong> ·
  <a href="https://github.com/yurgenium/WallWave/releases">All releases</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

---

**WallWave finds wallpapers, keeps your favorites and changes your desktop background automatically.** Start with interest-based search; optional on-device AI can refine selection as you rate images.

## 🚀 Get started

**No programming experience or extra packages are needed for the ready-to-run app.** A 64-bit Windows computer is required. Online sources need an internet connection.

1. **Download [WallWave.exe](https://github.com/yurgenium/WallWave/releases/download/v0.7.0/WallWave.exe).** It is also available under **Assets** on the [release page](https://github.com/yurgenium/WallWave/releases/tag/v0.7.0). The **Source code** archives are for development and are not needed to run the app.
2. **Double-click the downloaded file.** On the first launch, choose where to place the app. A **WallWave** folder will be created there. Wait for extraction and the app window to open.
3. **Open Settings → Interests and content.** Enter a few comma-separated interests, such as `nature, mountains, space`, then click **Save**. Other settings can stay at their defaults initially.
4. **Check Sources.** Wallhaven is enabled initially. To use your own pictures, add a **Local folder** source and select your wallpaper folder. Sources are also available in Settings.
5. **Click the manual wallpaper download button** on the main screen and wait for completion. Open an image you like and choose **Set wallpaper**. Downloading images alone does not change the desktop background.
6. **Rate a few images.** Likes and dislikes help refine selection. Automatic downloading, rotation and AI can be enabled separately later.

> **Suggested starting point:** **SFW**, up to **12 images per search**, and an unreviewed wallpaper limit of **30**. AI and automatic rotation are off by default.

For later launches, open `WallWave.exe` inside the chosen **WallWave** folder. The installation location is remembered.

## ✨ Main features

| Feature | What it does |
| --- | --- |
| **Interest-based discovery** | Tags and ratings guide selection from Wallhaven, DeviantArt, Pixabay, Konachan, Bing, NASA Images, Wikimedia Commons, local folders and compatible HTTPS JSON feeds. |
| **Rated local library** | Keep favorites, neutral and deferred images in separate views; duplicate images are filtered during downloads. |
| **Automatic downloading and rotation** | Choose intervals and schedules; background tasks account for idle time and system load. |
| **Separate profiles** | Each profile has its own library, ratings, tags, settings and sources; copying the main profile’s settings is optional. |
| **Custom folders** | Organize collections without copying files and rotate a selected folder with a long cycle before repeats. |
| **Wallpaper hold** | Keep the current wallpaper for 1, 6 or 12 hours, until a manual change or until a chosen time from the tray menu. |
| **Multiple monitors** | Configure rotation, content categories and framing for individual screens. |
| **Framing** | Crop, position, fit or mirror images to suit the display. |
| **Optional on-device AI** | CLIP compares images with your ratings and checks previews before originals are downloaded. |
| **Quick controls** | SFW / Sketchy / NSFW switches are at the top right of the library; ratings share a compact card control block. |
| **System tray controls** | Reopen the app, pause background work or quit from the icon near the clock. |
| **Export and restore** | Back up wallpapers, ratings and settings; API keys are excluded from exports. |
| **Two interface languages** | Russian and English are available in Settings. |

Cards show the **image source**. The more-actions menu contains details and the original source link.

Quote tag names that contain commas: `"tag, with comma", nature`. Clicking a card tag adds its whole name; right-clicking controls exclusion.

Disabling a source hides its unreviewed images. Removing it clears those library copies; rated images and personal source files are preserved.

## 👤 Profiles, folders and wallpaper hold

Open **Settings → Profiles** to create, rename or switch profiles. A new profile starts with an empty library. The optional settings copy includes the main profile’s tags; images, ratings and credentials remain separate. Only an inactive additional profile can be removed; its local data is retained for recovery.

Use **+** beside the library folders to create a collection. The folder button on a wallpaper card adds it without changing the current view or rating. Choose a collection for rotation to use only its wallpapers. An image may belong to several collections.

The tray menu offers **previous wallpaper** and **wallpaper hold**. When a hold expires, the app changes the wallpaper once and resumes the normal schedule. Time uses the 24-hour format, with a colon inserted automatically.

If a game or render makes the computer busy, ongoing AI work stops. Cancelling a download pauses automatic selection for one hour; the duration is adjustable in automation settings. Manual selection clears this pause. Retry unfinished downloads continues downloading previously found candidates. Error controls provide a diagnostic report and log access; the report excludes API keys and personal tags.

## 🎛️ Floating panel

The collapsed panel shows the current status. Expand it for the two selection progress bars, rotation timing, wallpaper hold and quick controls. Pausing **rotation** does not stop downloads. The default interval retains custom monitor intervals; the folder selector can restrict playback to a collection. Hovering the exposed part of a covered card moves the panel left; it returns after the pointer leaves.

**Settings → Help and diagnostics** provides the log, local report and issue link. The panel offers diagnostics when the service connection is lost or a serious save error occurs.

## ➕ Adding websites

Open **Sources → Add website**, paste an address and choose **Identify connection**. Known websites show the required fields and instructions: API key, Client ID / Client Secret, or user ID and key. **Test search and preview** checks the safe `landscape` query without downloading originals or changing the library. It does not guarantee results for personal interests. Saving the connection is a separate action.

New sites can be recognized as compatible **Danbooru JSON**, **Gelbooru / DAPI JSON** or WallWave JSON catalogs. Format and authentication can also be chosen manually and tested. This connects site-wide search; an artist or section URL does not restrict selection. **Request website support** opens a GitHub Issues form for the user to review and submit. The request link includes only the site origin, without query parameters or credentials.

Local folders and explicit JSON catalogs remain in the expandable add-source section. Updates never enable new websites automatically.

## 🌐 Sources and a shared taste profile

**Sources** shows a tile for each platform, with a description, toggle, access status and setup controls. **Paste from clipboard** fills a field; select **Save** to apply it, then enable the source. The same section is available in Settings.

| Source | Access | Mode |
| --- | --- | --- |
| **Wallhaven** | A key is required for NSFW; optional for SFW | Manual and background discovery |
| **DeviantArt** | Personal Client ID and Client Secret | Manual and background discovery; downloadable works only |
| **Pixabay** | Personal API key | Manual searches, SafeSearch, 24-hour response cache |
| **Konachan** | No key | Manual and background discovery, respecting SFW / Sketchy / NSFW |
| **Bing, NASA Images, Wikimedia Commons** | No key | Manual and background discovery |
| **Local folders** | A folder containing pictures | Personal originals are preserved |

**Getting access:** sign in to Pixabay and copy the key from its [API page](https://pixabay.com/api/docs/). For DeviantArt, open [application settings](https://www.deviantart.com/studio/apps), register a personal **Confidential** application and enter `http://localhost/` in **OAuth2 Redirect URI Whitelist**. After saving, return to the application list to find **Client ID** and **Client Secret**. Paste them into the corresponding WallWave fields using the paste buttons or **Ctrl+V**, then click **Save**. No account password is needed; browse tokens renew automatically. See [DeviantArt authentication](https://deviantart.readme.io/docs/authentication).

Each Pixabay run checks one page of up to 24 candidates; screening may leave fewer downloads than the requested batch. Pixabay stays manual because its [API policy](https://pixabay.com/api/docs/) requires a 24-hour response cache and restricts automated queries and systematic downloads. Standard access may supply images up to 1280 pixels; higher resolution is used when the API makes it available to the account.

**Ratings apply across the whole library.** Liking landscapes on DeviantArt helps find similar images on Wallhaven and Konachan. Tags of liked works supplement each platform’s search queries. Source adapters search and supply files; when AI is enabled, local **CLIP** screens visual suitability before original downloads. Saved interests and exclusions remain intact. Reliable rejection still requires both positive and negative examples.

New sources are **disabled by default** after updating. Existing source settings and credentials remain. Saved Wallhaven tags with spaces, commas and quotes work automatically; exclusion matching also accounts for spaces and underscores across platforms.

## 🧹 Library cleanup

- **By display count:** Settings → Automation lets you choose folders independently and set each threshold from **1 to 1000 displays**. New rules are off by default. A display counts after 30 seconds of visible desktop time and contributes to the wallpaper’s shared counter across monitors; showing the same image on several screens at once counts once. Current wallpapers are protected until replaced on every monitor. A one-minute grace period then allows cancellation by disabling the rule and saving. Existing display counts are included. Counts appear in each card’s more-actions menu.

- **A disabled source’s wallpapers:** open Sources, disable the source and select **Delete this source’s wallpapers**. All its library copies are deleted, including liked wallpapers. **No is available immediately**; **Yes, delete becomes available after 3 seconds**.
- **Excluded tags:** after saving settings, matching wallpapers are automatically deleted **after one minute**, including liked wallpapers. Matching uses the whole tag name, ignoring letter case. Remove the exclusion and save before cleanup to cancel it. Pausing the app pauses automatic cleanup; busy tasks may delay it.
- **Clean up tags now:** Settings → Interests and content provides **Delete wallpapers with excluded tags**, with the same confirmation.

**Deleting library copies is irreversible.** Original files in personal source folders are preserved. Ratings and fingerprints remain to prevent repeated downloads; cleared images disappear from the gallery and recent review history. The current desktop remains until the next wallpaper change. When upgrading, the one-minute grace period also applies to previously saved excluded tags.

## 👍 Ratings

Interests and exclusions support **up to 1000 tags each**, with up to 80 characters per tag. Each field provides **partial-name search**, counters and individual tag removal. Large lists are displayed in pages of 30. Search does not alter the list; edits and removals take effect after **Save**. Quote a tag containing a comma: `"artist, sample"`.

| Action | Effect |
| --- | --- |
| **Like** | A positive example for selecting similar images. |
| **Dislike** | A negative example that lowers the priority of similar images. |
| **Exclude** | Excludes this particular image from future rotation; it does not count as an AI dislike. |
| **Neutral** | Marks an image as reviewed without teaching a preference. |
| **Later** | Moves it to a separate view and leaves it out of automatic rotation. |

Dislike has a **5-second undo period**. **Later applies immediately**, without a timer. Excluding the current wallpaper selects a replacement from the available library. Files in connected personal source folders are preserved.

The button beside the previous arrow revisits **up to three recently rated images**; **Q** and **↑** provide the same action. Older disliked and excluded image files are cleared while ratings and fingerprints prevent repeat downloads. Disliked and excluded copies remain for up to five minutes to allow returning; current wallpapers are protected until replaced. Display-count rules apply only to Unreviewed, Liked, Neutral and Later.

## 🧠 Optional AI

Start by rating images you like and dislike. In Settings, choose **CLIP: 1 CPU thread** or **CLIP: up to 2 CPU threads**, then use **Cautious** screening as a starting point.

| Screening mode | Behavior |
| --- | --- |
| **Off** | No taste screening before downloading. |
| **Cautious** | Rejects clear mismatches; needs at least **5 likes and 5 dislikes**. |
| **Strict** | Rejects more uncertain matches; needs at least **3 likes and 3 dislikes**. Fewer originals may pass. |

Until enough ratings are available, images pass while the filter learns. Exclusions do not replace dislikes. Taste screening is an estimate, not a guarantee of a perfect match.

AI runs locally on **1–2 CPU threads without GPU use**. It requires at least **8 GiB RAM with around 3 GiB free**. The model downloads once, using approximately **90 MB**; analysis then runs on the computer. Background analysis waits for two minutes of idle time. Manual download screening runs during selection when resources allow.

Rejected originals are not downloaded. Without an available preview, Cautious allows the image unchecked and Strict defers it. Resource limits may also defer screening and downloading. **AI does not automatically clean the existing library or delete personal source files.**

## ⚙️ Download limits

**Images per search** controls how many new images one run tries to download. Selection continues to later pages after duplicates or rejected candidates. **Unreviewed wallpaper limit** controls how many downloaded images without a rating may accumulate; **0** disables that limit.

For example, a batch of **12** with **28 out of 30** unreviewed images allows at most **2** new downloads. Rate some images or adjust the limit to make room.

A source may have fewer suitable new images than requested. Partial downloads show the count and reason; the **Activity** log provides details.

**Time limit:** no new searches or transfers start after eight minutes. Active transfers finish within their own timeout and saved files remain in the library. Slow networks can result in a partial batch.

**Two selection bars:** Prepared counts wallpapers that passed selection, including saved and queued files. Downloaded counts only saved files. For example, **9 of 24 prepared and 5 of 24 downloaded** means four more wallpapers are queued or downloading. Rejected and merely inspected candidates are excluded; the bars do not switch to an individual file’s byte count.

Selection uses a small queue with **up to two original-file transfers at once**. Thumbnail screening comes before full metadata requests; Wallhaven metadata is cached for a day. Equally ranked candidates prefer smaller originals. Slow files are deferred, and one source’s errors do not block healthy sites. API requests are paced and respect source limits. **Continue selection** uses the same bounded batch rather than downloading every previously found candidate.

Completion time depends on source speed, original sizes and the number of suitable images. A source reporting a download limit is temporarily skipped, with its reason shown on the tile. Quality settings and the selected preference-filter mode are preserved.

## 📁 Data and updates

Wallpapers, ratings, preferences, source settings and API keys are stored separately from the app:

```text
%USERPROFILE%\WallWave\library
```

Press **Win + R**, paste this path and press **Enter** to open it. Settings include library export and restore; exports do not contain API keys. For a complete manual copy, quit the app from the tray first, then copy the data folder.

To update:

1. Right-click the WallWave icon near the clock and choose **Quit**. Hidden icons may be under the `˄` button.
2. Download and run the new release EXE.
3. The saved installation location is reused. **Wallpapers, ratings and settings are preserved.** The previous app version stays under `WallWave\app` for rollback.

Closing the window keeps WallWave running in the tray. Updates are installed manually; the releases page is also linked from **Settings → Updates → GitHub**.

<details>
<summary><strong>❓ Troubleshooting and shortcuts</strong></summary>

- **Fewer downloads than requested:** check the result, Activity log, unreviewed limit and enabled sources. Strict AI screening may reject many candidates.
- **No background downloads:** enable automatic refresh in Settings and check the automation status. Paused or busy systems wait for suitable conditions. Wallhaven requests are paced; rate limits trigger a cooldown. Interest and discovery searches retain separate page positions.
- **No new matching wallpapers:** check interests, excluded tags and content categories; consider broader tags or another source. The source itself may have no new images.
- **Download error:** the Activity log distinguishes network issues, source rate limits, unavailable files and storage limits. Short temporary failures are retried automatically; persistent problems can be retried later.
- **NSFW on Wallhaven:** enable the category and add a personal Wallhaven API key in the source settings. SFW is the default.
- **No visible window:** check the tray icon near the clock. Clicking it reopens the app.
- **GitHub access error:** a private repository requires an account with access; otherwise obtain the ready-to-run EXE from the project owner.
- **Reporting an issue:** include the app version, source and Activity message. API keys and a personal library are not needed.

Preview controls can use **Enter and arrows** or **Space/Tab and A/D**, selected in Settings → Shortcuts. **1–5** apply ratings, **F** opens framing, **R** resets a rating, **Backspace** cancels a pending Dislike, and **Q** or **↑** revisits up to three recently rated wallpapers. **F1 / F2 / F3** toggle SFW / Sketchy / NSFW.

To assign a global shortcut, select the action’s field, press a combination such as **Alt+1**, then select **Save**. Registration status appears below the field. Backspace/Delete clears the field; Escape cancels the edit. The app’s global shortcuts are temporarily disabled while recording.

</details>

---

[Changelog](CHANGELOG.md) · [Development](wallbloom/docs/DEVELOPMENT.md) · [Privacy](wallbloom/docs/PRIVACY.md) · [MIT License](LICENSE)
