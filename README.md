# WallWave — подборщик обоев для Windows

[Русский](#русский) · [English](#english)

## Русский

**Обои, которые подходят именно вам.** WallWave помогает находить изображения для рабочего стола, учитывать ваши интересы и автоматически менять фон. Отмечайте понравившиеся обои — ваши оценки улучшают последующий подбор.

### Основные возможности

- **Подбор по интересам** — изображения из Wallhaven и ваших локальных папок.
- **Обучение на оценках** — понравившиеся обои влияют на рекомендации; нежелательные можно исключить.
- **Автоматическая смена** — настройте интервал или расписание. Фоновые задачи учитывают нагрузку компьютера.
- **Кадр под ваш экран** — обрезка, вписывание и отдельные настройки мониторов.
- **Локальная библиотека** — скачанные изображения, оценки и настройки сохраняются на компьютере.
- **Необязательный AI-анализ** — локальная модель помогает учитывать визуальное сходство изображений.

### Как начать

**Готовое приложение скачивается из [Releases](https://github.com/yurgenium/WallWave/releases)**. EXE не хранится среди исходников в корне GitHub.

Для готового приложения нужен **Windows x64**.

1. Запустите **`WallWave.exe`** из готовой сборки. Название скачанного файла также может быть `WallWave-Windows-x64.exe`.
2. При первом запуске **выберите место размещения**. Программа создаст там папку **WallWave**. Следующие запуски используют сохранённое место; повторная распаковка не нужна.
3. Откройте **настройки**, укажите ваши интересы и параметры экрана. В разделе источников можно добавить собственную папку с изображениями.
4. Запустите подбор, дождитесь загрузки и выберите изображение. Нажмите **«Установить»**, чтобы применить обои.
5. Отмечайте понравившиеся изображения. При желании включите **автоматический поиск и смену** в настройках.

**Закрытие окна оставляет приложение в трее.** Чтобы полностью завершить работу, выберите пункт выхода в меню значка рядом с часами.

### Обновление и ваши данные

**Обои, предпочтения, оценки и ключи хранятся отдельно от программы**, в `%USERPROFILE%\Wallbloom\library`. Название папки сохранено для совместимости. Замена EXE не удаляет эту библиотеку.

Перед обновлением завершите приложение через трей, затем запустите новую сборку. Ссылку на страницу выпусков можно открыть через **Настройки → Обновления → GitHub**. Обновления устанавливаются вручную.

**Личные данные и обои не входят в репозиторий.** Их исключение проверяется перед коммитом и отправкой. Подробности: [защита личных данных](wallbloom/docs/PRIVACY.md).

**Проект находится в разработке.** [История изменений](CHANGELOG.md) · [Для разработчиков](wallbloom/docs/DEVELOPMENT.md) · [Лицензия MIT](LICENSE)

## English

**WallWave is a Windows wallpaper recommender and automatic wallpaper changer.** Discover desktop backgrounds from Wallhaven or your local folders, rate your favorites and improve future recommendations.

**Main features:** interest-based recommendations, automatic rotation and scheduling, per-monitor framing, a local library and optional on-device AI image analysis.

### Getting started

1. Run **`WallWave.exe`** from a compiled Windows x64 build. Some downloads use the name `WallWave-Windows-x64.exe`.
2. Choose an installation location on the first launch. A separate **WallWave** folder is created and reused later.
3. Set your interests, screen preferences and image sources in **Settings**.
4. Find and download wallpapers, select an image and click **Set wallpaper**. Rate images and optionally enable automatic search and rotation.

**Closing the window keeps the app in the tray.** Use the tray menu to quit completely before replacing the EXE with a newer build.

**Personal wallpapers, ratings, preferences and keys stay outside the app**, in `%USERPROFILE%\Wallbloom\library`, and are excluded from this repository. Local Git checks help prevent accidental uploads.

**In development.** [Changelog (RU)](CHANGELOG.md) · [Privacy safeguards (RU)](wallbloom/docs/PRIVACY.md) · [Developer documentation (RU)](wallbloom/docs/DEVELOPMENT.md) · [MIT license](LICENSE)

## Структура репозитория

- **README.md** — описание и инструкция запуска.
- **CHANGELOG.md** — история изменений.
- **LICENSE** — лицензия.
- **wallbloom/** — исходники приложения, тесты, инструменты и техническая документация.

Готовое приложение, установленная папка **WallWave/** и локальный **archive/** в Git не включаются.
