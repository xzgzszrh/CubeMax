import { Dict } from "../../entities/dict.entity";
import { DataSource } from "../../typeorm";
import { BaseSeeder } from "./base.seeder";

const DICT_GROUP = "decorate";
const DICT_KEY = "menu-config";

interface DecorateMenuItem {
    id?: string;
    items?: DecorateMenuItem[];
    [key: string]: any;
}

interface DecorateMenuGroup {
    id?: string;
    items?: DecorateMenuItem[];
    [key: string]: any;
}

interface DecorateMenuConfig {
    menus?: DecorateMenuItem[];
    groups?: DecorateMenuGroup[];
    [key: string]: any;
}

/**
 * Page configuration seeder
 *
 * Initializes the frontend home page menu configuration
 */
export class PageSeeder extends BaseSeeder {
    readonly name = "PageSeeder";
    readonly priority = 40;

    async run(dataSource: DataSource): Promise<void> {
        const dictRepository = dataSource.getRepository(Dict);

        try {
            const menuConfig = await this.loadConfig<DecorateMenuConfig>("web-menu.json");

            // Check whether the menu configuration already exists
            const existing = await dictRepository.findOne({
                where: { key: DICT_KEY, group: DICT_GROUP },
            });

            if (existing) {
                const currentConfig = this.parseMenuConfig(existing.value);
                const mergedConfig = this.mergeMenuConfig(currentConfig, menuConfig);

                if (JSON.stringify(currentConfig) === JSON.stringify(mergedConfig)) {
                    this.logInfo("Menu configuration is up to date");
                    return;
                }

                existing.value = JSON.stringify(mergedConfig);
                await dictRepository.save(existing);
                this.logSuccess("Menu configuration synchronized successfully");
                return;
            }

            const config = dictRepository.create({
                key: DICT_KEY,
                value: JSON.stringify(menuConfig),
                group: DICT_GROUP,
                description: "前台菜单配置",
                isEnabled: true,
                sort: 0,
            });

            await dictRepository.save(config);

            this.logSuccess("Menu configuration initialized successfully");
        } catch (error) {
            this.logError(`Menu configuration initialization failed: ${error.message}`);
            throw error;
        }
    }

    private parseMenuConfig(value: string): DecorateMenuConfig {
        try {
            return JSON.parse(value);
        } catch (error) {
            this.logWarn(
                `Failed to parse existing menu configuration, using defaults: ${error.message}`,
            );
            return {};
        }
    }

    private mergeMenuConfig(
        currentConfig: DecorateMenuConfig,
        defaultConfig: DecorateMenuConfig,
    ): DecorateMenuConfig {
        return {
            ...defaultConfig,
            ...currentConfig,
            menus: this.mergeById(currentConfig.menus ?? [], defaultConfig.menus ?? []),
            groups: this.mergeGroups(currentConfig.groups ?? [], defaultConfig.groups ?? []),
        };
    }

    private mergeGroups(
        currentGroups: DecorateMenuGroup[],
        defaultGroups: DecorateMenuGroup[],
    ): DecorateMenuGroup[] {
        const mergedGroups = this.mergeById(currentGroups, defaultGroups);
        const defaultGroupMap = new Map(defaultGroups.map((group) => [group.id, group]));

        return mergedGroups.map((group) => {
            const defaultGroup = defaultGroupMap.get(group.id);

            if (!defaultGroup?.items?.length) {
                return group;
            }

            return {
                ...group,
                items: this.mergeById(group.items ?? [], defaultGroup.items),
            };
        });
    }

    private mergeById<T extends { id?: string }>(currentItems: T[], defaultItems: T[]): T[] {
        const existingIds = new Set(currentItems.map((item) => item.id).filter(Boolean));
        const missingItems = defaultItems.filter((item) => item.id && !existingIds.has(item.id));

        return [...currentItems, ...missingItems];
    }
}
