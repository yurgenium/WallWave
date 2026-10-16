<p align="center">
  <img src="wallbloom/desktop/icons/working.png" width="64" height="64" alt="WallWave">
</p>

<h1 align="center">WallWave</h1>

<p align="center">
  Обои по вашим интересам · автоматическая смена · локальный ИИ<br>
  Wallpapers for your interests · automatic rotation · on-device AI
</p>

<p align="center">
  <strong><a href="https://github.com/yurgenium/WallWave/releases/download/v0.5.18/WallWave.exe">⬇ Скачать для Windows / Download for Windows</a></strong><br>
  Windows x64 · Русский / English · 0.5.18 · Тестовая версия / Preview
</p>

<p align="center">
  <a href="#русский">Русский</a> · <a href="#english">English</a> ·
  <a href="https://github.com/yurgenium/WallWave/releases">Все выпуски / All releases</a> ·
  <a href="CHANGELOG.md">Что нового / Changelog</a>
</p>

---

## Русский

**WallWave помогает находить обои, сохранять понравившиеся и автоматически менять фон рабочего стола.** Начать можно с обычного поиска по интересам. По мере накопления оценок необязательный локальный ИИ помогает учитывать визуальные предпочтения.

### 🚀 Первый запуск — от скачивания до новых обоев

**Для готового приложения не нужны навыки программирования, Node.js или установка дополнительных пакетов.** Нужна 64-разрядная Windows и подключение к интернету для онлайн-источников.

1. **Скачайте [WallWave.exe](https://github.com/yurgenium/WallWave/releases/download/v0.5.18/WallWave.exe).** На [странице выпуска](https://github.com/yurgenium/WallWave/releases/tag/v0.5.18) он находится в блоке **Assets** («Файлы выпуска»). Архивы **Source code** содержат исходники и для обычного запуска не нужны.
2. **Запустите скачанный файл двойным щелчком.** При первом запуске выберите место размещения. В нём появится папка **WallWave** с файлами приложения. Дождитесь распаковки и открытия окна.
3. **Откройте «Настройки → Интересы и контент».** Укажите несколько интересов через запятую, например `nature, mountains, space`, и нажмите **«Сохранить»**. Для начала можно оставить остальные параметры по умолчанию.
4. **Проверьте «Источники».** Wallhaven включён изначально. Для личных изображений добавьте источник «Локальная папка» и укажите папку с обоями. Этот же раздел доступен в настройках.
5. **Нажмите «Ручная загрузка обоев»** на главном экране и дождитесь окончания. Откройте понравившееся изображение и нажмите **«Установить»**. Загрузка сама по себе не меняет текущий фон.
6. **Оцените несколько изображений.** Лайки и дизлайки постепенно помогают уточнять подбор. Автоматическую загрузку, смену обоев и ИИ можно включить позже, когда основные настройки уже подходят.

> **С чего начать:** безопасная категория **SFW**, до **12 изображений за поиск**, лимит **30 непросмотренных обоев**. ИИ и автоматическая смена по умолчанию выключены — их можно включить отдельно.

**Повторный запуск:** откройте `WallWave.exe` в выбранной папке **WallWave**. Место установки запоминается; заново выбирать его каждый раз не требуется.

### ✨ Что умеет WallWave

| Возможность | Как это помогает |
| --- | --- |
| **Поиск по интересам** | Теги и оценки влияют на подбор. Доступны Wallhaven, Bing, NASA Images, Wikimedia Commons, локальные папки и совместимые JSON-каталоги по HTTPS. |
| **Библиотека с оценками** | Понравившиеся, нейтральные и отложенные обои легко найти отдельно. Повторы отсекаются при загрузке. |
| **Автоматическое пополнение и смена** | Можно задать интервалы и расписание. Фоновые задачи учитывают простой и нагрузку компьютера. |
| **Несколько мониторов** | Для экранов доступны отдельные параметры смены, категорий и кадрирования. |
| **Кадрирование и подгонка** | Обрезка, положение кадра, вписывание и отражение помогают подобрать изображение под экран. |
| **Необязательный локальный ИИ** | CLIP сравнивает изображения с оценёнными и проверяет миниатюры перед скачиванием оригиналов. |
| **Быстрые действия** | Фильтры SFW / Sketchy / NSFW находятся справа вверху библиотеки; оценки собраны в компактный блок карточки. |
| **Работа из трея** | Закрытое окно не мешает фоновой работе. Значок рядом с часами позволяет открыть приложение, включить паузу или выйти. |
| **Экспорт и восстановление** | Библиотеку, настройки и оценки можно экспортировать; API-ключи в экспорт не включаются. |
| **Русский и английский** | Язык интерфейса выбирается в настройках. |

В карточках отображается **источник изображения**. Подробности и ссылка на исходную страницу доступны в меню дополнительных действий.

Теги с запятой записываются в кавычках: `"название, с запятой", nature`. Нажатие на тег в карточке добавляет его целиком; правое нажатие управляет исключением.

Отключение источника скрывает его неоценённые изображения. Удаление источника освобождает такие копии из библиотеки; оценённые изображения и личные исходные файлы сохраняются.

### 🧹 Очистка библиотеки

- **По количеству показов:** в «Настройки → Автоматизация» можно отдельно выбрать папки и задать каждой порог **от 1 до 1000 показов**. Новые правила изначально выключены. Показ засчитывается после 30 секунд видимого рабочего стола и сохраняется в общем счётчике обоев независимо от монитора; одновременный показ одного изображения на нескольких экранах считается одним. Текущие обои защищены до смены на всех мониторах. Затем начинается минутная отсрочка, в течение которой можно отключить правило и сохранить настройки. Уже накопленные показы учитываются. Количество показов видно в меню «Другие действия» карточки.

- **Обои отключённого источника:** откройте «Источники», отключите нужный источник и нажмите **«Удалить обои этого источника»**. Удаляются все его копии из библиотеки, включая понравившиеся. В окне подтверждения **«Нет» доступно сразу**, а **«Да, удалить» — через 3 секунды**.
- **Исключённые теги:** после сохранения настроек совпадающие обои автоматически удаляются **через минуту**, включая понравившиеся. Совпадение проверяется по полному имени тега, без учёта регистра. Если убрать тег из исключений и сохранить настройки до очистки, удаление отменится. Пауза приложения приостанавливает автоматическую очистку; занятая программа выполнит её позднее.
- **Очистить по тегам сразу:** в «Настройки → Интересы и контент» доступна кнопка **«Удалить обои с исключёнными тегами»** с таким же подтверждением.

**Удаление копий необратимо.** Личные файлы в папках-источниках сохраняются. Оценки и отпечатки остаются для защиты от повторного скачивания; очищенные изображения исчезают из галереи и истории возврата. Уже установленные обои сохраняются на рабочем столе до следующей смены. При обновлении с прежней версии минутная отсрочка применяется и к уже сохранённым исключённым тегам.

### 👍 Как работают оценки

В списках интересов и исключений допускается **до 1000 тегов в каждом**, длина одного тега — до 80 символов. Под полями есть **поиск по части названия**, счётчики и удаление отдельных тегов. Большие списки отображаются страницами по 30 тегов. Поиск ничего не меняет; редактирование и удаление применяются после **«Сохранить»**. Тег с запятой в текстовом поле указывается в кавычках: `"artist, sample"`.

| Действие | Результат |
| --- | --- |
| **Нравится** | Положительный пример для подбора похожих изображений. |
| **Не нравится** | Отрицательный пример: похожие изображения получают более низкий приоритет. |
| **Исключить** | Убирает конкретное изображение из дальнейшей смены. Не считается дизлайком для ИИ. |
| **Нейтрально** | Отмечает изображение как просмотренное, без обучения предпочтениям. |
| **Отложить** | Переносит обои в отдельную подборку и исключает из автоматической смены. |

Дизлайк применяется через **5 секунд**; за это время действие можно отменить. **«Отложить» применяется сразу**, без таймера. Если исключить текущие обои, приложение подберёт замену из доступной библиотеки. Исходные файлы в подключённой личной папке сохраняются.

Кнопка рядом с левой стрелкой в просмотре возвращает к **трём последним оценённым обоям**; доступны также **Q / Й** и **↑**. Файлы старых дизлайков и исключений освобождаются, а оценки и отпечатки сохраняются для защиты от повторной загрузки. Файлы дизлайков и исключений сохраняются до 5 минут для возврата; текущие обои защищены до смены. Новые правила очистки по показам применяются только к неоценённым, понравившимся, нейтральным и отложенным.

### 🧠 Как включить ИИ и выбрать режим

1. Сначала отметьте изображения, которые нравятся и не нравятся.
2. В настройках метода подбора выберите **«CLIP: 1 поток CPU»** или **«CLIP: до 2 потоков CPU»**.
3. В параметре **«Отбор перед скачиванием»** оставьте **«Осторожный»**. Это подходящий начальный вариант; строгий режим можно попробовать позднее.

| Режим отбора | Что происходит перед скачиванием |
| --- | --- |
| **Выключен** | Предварительная проверка вкусов не используется. |
| **Осторожный** | Отклоняются явно неподходящие изображения; их оригиналы не скачиваются. Нужны минимум **5 лайков и 5 дизлайков**. |
| **Строгий** | Отклоняется больше сомнительных совпадений. Нужны минимум **3 лайка и 3 дизлайка**; подходящих загрузок может быть меньше. |

Пока оценок недостаточно, фильтр пропускает изображения и накапливает примеры. Это вероятностная оценка вкусов, а не гарантия точного совпадения. **Исключения не заменяют дизлайки.**

ИИ работает на компьютере, использует **1–2 потока CPU, без GPU**. Требуется не менее **8 ГиБ оперативной памяти**, из них около **3 ГиБ свободно**. При первом использовании загружается модель — примерно **90 МБ**; затем анализ выполняется локально. Фоновый анализ ожидает двух минут простоя. Проверка миниатюр при ручной загрузке выполняется в ходе подбора, если позволяют ресурсы.

Если ИИ отклоняет изображение, его оригинал не скачивается. Без доступной миниатюры осторожный режим допускает загрузку без проверки, строгий откладывает её. При нехватке ресурсов проверка и загрузка могут быть отложены. **Существующая библиотека и личные исходные файлы автоматически не очищаются по оценке ИИ.**

### ⚙️ Два разных лимита загрузки

- **«Изображений за поиск»** — сколько новых обоев приложение пытается скачать за одно нажатие. После повторов и отклонений поиск продолжается на следующих страницах, пока не набрана порция или не достигнуто ограничение.
- **«Лимит непросмотренных обоев»** — сколько уже скачанных изображений без оценки разрешено накопить. Значение **0** отключает этот лимит.

Например, при порции **12** и наличии **28 из 30** непросмотренных обоев будет скачано не больше **2**. Чтобы освободить место в таком пуле, можно оценить изображения или изменить лимит.

Реально подходящих новых обоев может оказаться меньше порции. Приложение показывает частичный результат и причину остановки: закончились варианты, сработал фильтр, достигнут предел проверки или возникла ошибка. Подробности находятся в **«Журнале»**.

### 📁 Где находятся обои и настройки

**Папка данных:**

```text
%USERPROFILE%\WallWave\library
```

Чтобы открыть её, нажмите **Win + R**, вставьте путь и нажмите **Enter**. Здесь находятся изображения, оценки, настройки, параметры источников и API-ключи. Это отдельная папка от установленного приложения.

Для резервной копии можно воспользоваться разделом **«Экспорт и восстановление библиотеки»** в настройках. Экспорт не включает API-ключи. Если нужна полная ручная копия, сначала завершите приложение через трей и скопируйте папку данных.

### 🔄 Как обновить приложение

1. Нажмите правой кнопкой на значок WallWave рядом с часами и выберите **«Выход»**. При необходимости раскройте скрытые значки кнопкой `˄`.
2. Скачайте EXE нового выпуска и запустите его.
3. Программа использует сохранённую папку приложения. **Обои, оценки и настройки сохраняются**, повторно настраивать библиотеку не требуется. Предыдущая версия остаётся в `WallWave\app` для отката.

Обновления устанавливаются вручную. Страница выпусков доступна также через **«Настройки → Обновления → GitHub»**.

<details>
<summary><strong>❓ Если что-то непонятно или не работает</strong></summary>

**После закрытия окна приложение осталось запущено.** Это обычная работа из трея. Для полного завершения используйте «Выход» в меню значка рядом с часами.

**Скачано меньше, чем указано в порции.** Проверьте сообщение о результате, «Журнал», лимит непросмотренных обоев и включённые источники. В строгом режиме ИИ может отклонить большую часть вариантов.

**Фоновые загрузки не появляются.** Включите автоматический подбор в настройках и проверьте статус автоматизации: при паузе или высокой нагрузке он ожидает подходящих условий. Wallhaven обрабатывает запросы последовательно; при ограничении частоты приложение выдерживает паузу. Прогресс поиска по интересам и для разнообразия сохраняется отдельно.

**Подходящих обоев нет.** Проверьте интересы, исключённые теги и категории. Попробуйте более общие теги или другой источник. Новые изображения могут отсутствовать и в самом источнике.

**Ошибка загрузки.** В «Журнале» указано, что произошло: проблема сети, ограничение источника, недоступное изображение или лимит данных. Короткие временные сетевые сбои повторяются автоматически; если ошибка осталась, можно повторить подбор позднее.

**Нужна категория NSFW на Wallhaven.** Включите её переключателем на главном экране и добавьте личный API-ключ Wallhaven через настройки источника. По умолчанию используется безопасная категория SFW.

**Окно не видно после запуска.** Проверьте значки рядом с часами: приложение могло остаться в трее. Откройте его нажатием на значок WallWave.

**Вместо скачивания открывается ошибка GitHub.** Для закрытого репозитория нужен вход в аккаунт с предоставленным доступом. Если доступа нет, готовый EXE можно получить у владельца проекта.

При сообщении об ошибке полезно указать версию приложения, источник и текст из «Журнала». API-ключи и личную библиотеку передавать не требуется.

</details>

<details>
<summary><strong>⌨️ Управление в открытом просмотре</strong></summary>

В **«Настройки → Горячие клавиши»** выбирается раскладка: **Enter и стрелки** либо **Пробел/Tab и A/D**.

Для глобального сочетания выберите поле нужного действия, нажмите, например, **Alt+1**, затем **«Сохранить»**. Результат регистрации появится под полем. Backspace/Delete очищает поле, Escape отменяет ввод. Во время редактирования глобальные сочетания приложения временно отключены.

- **1–5** — нравится, не нравится, исключить, нейтрально, отложить.
- **F** — кадрирование; **R** — сброс оценки.
- **Backspace** — отмена дизлайка, пока идёт отсчёт; **Q / Й** или **↑** — возврат к трём последним оценённым обоям.
- **F1 / F2 / F3** — быстрый доступ к категориям SFW / Sketchy / NSFW.

</details>

---

## English

**WallWave finds wallpapers, keeps your favorites and changes your desktop background automatically.** Start with interest-based search; optional on-device AI can refine selection as you rate images.

### 🚀 Get started

**No programming experience, Node.js or extra packages are needed for the ready-to-run app.** A 64-bit Windows computer is required. Online sources need an internet connection.

1. **Download [WallWave.exe](https://github.com/yurgenium/WallWave/releases/download/v0.5.18/WallWave.exe).** It is also available under **Assets** on the [release page](https://github.com/yurgenium/WallWave/releases/tag/v0.5.18). The **Source code** archives are for development and are not needed to run the app.
2. **Double-click the downloaded file.** On the first launch, choose where to place the app. A **WallWave** folder will be created there. Wait for extraction and the app window to open.
3. **Open Settings → Interests and content.** Enter a few comma-separated interests, such as `nature, mountains, space`, then click **Save**. Other settings can stay at their defaults initially.
4. **Check Sources.** Wallhaven is enabled initially. To use your own pictures, add a **Local folder** source and select your wallpaper folder. Sources are also available in Settings.
5. **Click the manual wallpaper download button** on the main screen and wait for completion. Open an image you like and choose **Set wallpaper**. Downloading images alone does not change the desktop background.
6. **Rate a few images.** Likes and dislikes help refine selection. Automatic downloading, rotation and AI can be enabled separately later.

> **Suggested starting point:** **SFW**, up to **12 images per search**, and an unreviewed wallpaper limit of **30**. AI and automatic rotation are off by default.

For later launches, open `WallWave.exe` inside the chosen **WallWave** folder. The installation location is remembered.

### ✨ Main features

| Feature | What it does |
| --- | --- |
| **Interest-based discovery** | Tags and ratings guide selection from Wallhaven, Bing, NASA Images, Wikimedia Commons, local folders and compatible HTTPS JSON feeds. |
| **Rated local library** | Keep favorites, neutral and deferred images in separate views; duplicate images are filtered during downloads. |
| **Automatic downloading and rotation** | Choose intervals and schedules; background tasks account for idle time and system load. |
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

### 🧹 Library cleanup

- **By display count:** Settings → Automation lets you choose folders independently and set each threshold from **1 to 1000 displays**. New rules are off by default. A display counts after 30 seconds of visible desktop time and contributes to the wallpaper’s shared counter across monitors; showing the same image on several screens at once counts once. Current wallpapers are protected until replaced on every monitor. A one-minute grace period then allows cancellation by disabling the rule and saving. Existing display counts are included. Counts appear in each card’s more-actions menu.

- **A disabled source’s wallpapers:** open Sources, disable the source and select **Delete this source’s wallpapers**. All its library copies are deleted, including liked wallpapers. **No is available immediately**; **Yes, delete becomes available after 3 seconds**.
- **Excluded tags:** after saving settings, matching wallpapers are automatically deleted **after one minute**, including liked wallpapers. Matching uses the whole tag name, ignoring letter case. Remove the exclusion and save before cleanup to cancel it. Pausing the app pauses automatic cleanup; busy tasks may delay it.
- **Clean up tags now:** Settings → Interests and content provides **Delete wallpapers with excluded tags**, with the same confirmation.

**Deleting library copies is irreversible.** Original files in personal source folders are preserved. Ratings and fingerprints remain to prevent repeated downloads; cleared images disappear from the gallery and recent review history. The current desktop remains until the next wallpaper change. When upgrading, the one-minute grace period also applies to previously saved excluded tags.

### 👍 Ratings

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

### 🧠 Optional AI

Start by rating images you like and dislike. In Settings, choose **CLIP: 1 CPU thread** or **CLIP: up to 2 CPU threads**, then use **Cautious** screening as a starting point.

| Screening mode | Behavior |
| --- | --- |
| **Off** | No taste screening before downloading. |
| **Cautious** | Rejects clear mismatches; needs at least **5 likes and 5 dislikes**. |
| **Strict** | Rejects more uncertain matches; needs at least **3 likes and 3 dislikes**. Fewer originals may pass. |

Until enough ratings are available, images pass while the filter learns. Exclusions do not replace dislikes. Taste screening is an estimate, not a guarantee of a perfect match.

AI runs locally on **1–2 CPU threads without GPU use**. It requires at least **8 GiB RAM with around 3 GiB free**. The model downloads once, using approximately **90 MB**; analysis then runs on the computer. Background analysis waits for two minutes of idle time. Manual download screening runs during selection when resources allow.

Rejected originals are not downloaded. Without an available preview, Cautious allows the image unchecked and Strict defers it. Resource limits may also defer screening and downloading. **AI does not automatically clean the existing library or delete personal source files.**

### ⚙️ Download limits

**Images per search** controls how many new images one run tries to download. Selection continues to later pages after duplicates or rejected candidates. **Unreviewed wallpaper limit** controls how many downloaded images without a rating may accumulate; **0** disables that limit.

For example, a batch of **12** with **28 out of 30** unreviewed images allows at most **2** new downloads. Rate some images or adjust the limit to make room.

A source may have fewer suitable new images than requested. Partial downloads show the count and reason; the **Activity** log provides details.

### 📁 Data and updates

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

[История изменений / Changelog](CHANGELOG.md) · [Разработка / Development](wallbloom/docs/DEVELOPMENT.md) · [Конфиденциальность / Privacy](wallbloom/docs/PRIVACY.md) · [MIT License](LICENSE)
